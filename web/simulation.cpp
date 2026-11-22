// SPDX-License-Identifier: GPL-3.0-or-later
#include "cfg/ptree.h"
#include "physics/cardynamics.h"
#include "physics/carinput.h"
#include "physics/collision_contact.h"
#include "physics/dynamicsworld.h"
#include "physics/tracksurface.h"
#include "vehicle.h"

#include <btBulletDynamicsCommon.h>
#include <emscripten/emscripten.h>

#include <algorithm>
#include <array>
#include <cmath>
#include <iostream>
#include <sstream>

namespace
{
constexpr float timeStep = 1.0f / 90.0f;
constexpr int poseSize = 7;

class Simulation
{
public:
	Simulation(const float * edges, int segments)
		: dispatcher(&collisionConfig),
		  world(&dispatcher, &broadphase, &solver, &collisionConfig, timeStep, 1),
		  config(makeCoupeConfig()),
		  tire(std::make_shared<PTree>()),
		  inputs(CarInput::INVALID, 0.0f)
	{
		std::istringstream tireStream(tireConfig);
		read_ini(tireStream, *tire);
		asphalt.type = TrackSurface::ASPHALT;
		asphalt.frictionNonTread = 1.02f;
		asphalt.frictionTread = 0.91f;
		asphalt.rollResistanceCoefficient = 1.0f;
		dirt.type = TrackSurface::GRAVEL;
		dirt.frictionNonTread = 0.44f;
		dirt.frictionTread = 0.68f;
		dirt.rollResistanceCoefficient = 3.0f;
		dirt.rollingDrag = 9.0f;

		for (int i = 0; i < segments; ++i)
		{
			const float * a = edges + i * 4;
			const float * b = edges + ((i + 1) % segments) * 4;
			const btVector3 left(a[0], a[1], 0), right(a[2], a[3], 0);
			const btVector3 nextLeft(b[0], b[1], 0), nextRight(b[2], b[3], 0);
			roadMesh.addTriangle(left, right, nextLeft);
			roadMesh.addTriangle(right, nextRight, nextLeft);
		}
		roadShape = std::make_unique<btBvhTriangleMeshShape>(&roadMesh, true);
		road.setCollisionShape(roadShape.get());
		terrain.setCollisionShape(&terrainShape);
		addSurface(road, asphalt);
		addSurface(terrain, dirt);
		world.setContactAddedCallback(&CarDynamics::WheelContactCallback);
	}

	~Simulation()
	{
		car.reset();
		world.removeCollisionObject(&road);
		world.removeCollisionObject(&terrain);
	}

	bool reset(float x, float y, float heading)
	{
		car.reset();
		auto vehicle = std::make_unique<CarDynamics>();
		const btVector3 position(x, y, 0.5f);
		const btQuaternion orientation(btVector3(0, 0, 1), heading);
		if (!vehicle->Load(config, "club", position, orientation, false, world,
			[this](const std::string & name) -> std::shared_ptr<const PTree>
			{
				return name == "clubp" ? tire : nullptr;
			}, std::cerr))
		{
			return false;
		}

		car = std::move(vehicle);
		car->AlignWithGround();
		car->SetAutoShift(true);
		car->SetAutoClutch(true);
		car->SetAutoReverse(true);
		car->SetABS(true);
		std::fill(inputs.begin(), inputs.end(), 0.0f);
		inputs[CarInput::START_ENGINE] = 1;
		inputs[CarInput::FIRST_GEAR] = 1;
		car->Update(inputs);
		inputs[CarInput::START_ENGINE] = 0;
		inputs[CarInput::FIRST_GEAR] = 0;
		for (int i = 0; i < 25; ++i)
			world.update(timeStep);
		return true;
	}

	void step(float throttle, float brake, float steer, bool handbrake)
	{
		inputs[CarInput::THROTTLE] = std::clamp(throttle, 0.0f, 1.0f);
		inputs[CarInput::BRAKE] = std::clamp(brake, 0.0f, 1.0f);
		inputs[CarInput::STEER_LEFT] = std::clamp(-steer, 0.0f, 1.0f);
		inputs[CarInput::STEER_RIGHT] = std::clamp(steer, 0.0f, 1.0f);
		inputs[CarInput::HANDBRAKE] = handbrake ? 1.0f : 0.0f;
		car->Update(inputs);
		world.update(timeStep);
	}

	const float * readState()
	{
		writePose(0, car->GetPosition(), car->GetOrientation());
		for (int i = 0; i < WHEEL_COUNT; ++i)
		{
			const auto wheel = static_cast<WheelPosition>(i);
			writePose((i + 1) * poseSize, car->GetWheelPosition(wheel), car->GetWheelOrientation(wheel));
		}
		const btVector3 velocity = car->GetVelocity();
		const btMatrix3x3 frame(car->GetOrientation());
		const float forwardSpeed = velocity.dot(frame.getColumn(1));
		const float sideSpeed = velocity.dot(frame.getColumn(0));
		state[35] = std::hypot(velocity.x(), velocity.y());
		state[36] = car->GetTachoRPM();
		state[37] = car->GetTransmission().GetGear();
		state[38] = std::atan2(sideSpeed, std::max(std::abs(forwardSpeed), 0.1f));
		state[39] = car->GetWheelContact(REAR_LEFT).GetSurface().type == TrackSurface::ASPHALT &&
			car->GetWheelContact(REAR_RIGHT).GetSurface().type == TrackSurface::ASPHALT;
		state[40] = forwardSpeed;
		return state.data();
	}

private:
	void addSurface(btCollisionObject & surface, TrackSurface & material)
	{
		surface.setUserPointer(&material);
		surface.setFriction(0.7f);
		world.addCollisionObject(&surface);
	}

	void writePose(int offset, const btVector3 & position, const btQuaternion & rotation)
	{
		for (int i = 0; i < 3; ++i)
			state[offset + i] = position[i];
		for (int i = 0; i < 4; ++i)
			state[offset + 3 + i] = rotation[i];
	}

	btDefaultCollisionConfiguration collisionConfig;
	btCollisionDispatcher dispatcher;
	btDbvtBroadphase broadphase;
	btSequentialImpulseConstraintSolver solver;
	btTriangleMesh roadMesh;
	std::unique_ptr<btBvhTriangleMeshShape> roadShape;
	btStaticPlaneShape terrainShape {btVector3(0, 0, 1), -0.07f};
	DynamicsWorld world;
	btCollisionObject road;
	btCollisionObject terrain;
	TrackSurface asphalt;
	TrackSurface dirt;
	PTree config;
	std::shared_ptr<PTree> tire;
	std::vector<float> inputs;
	std::unique_ptr<CarDynamics> car;
	std::array<float, 41> state {};
};

std::unique_ptr<Simulation> simulation;
}

extern "C"
{
EMSCRIPTEN_KEEPALIVE int createSimulation(const float * edges, int segments)
{
	if (!edges || segments < 3)
		return 0;
	simulation = std::make_unique<Simulation>(edges, segments);
	return 1;
}

EMSCRIPTEN_KEEPALIVE int resetCar(float x, float y, float heading)
{
	return simulation && simulation->reset(x, y, heading);
}

EMSCRIPTEN_KEEPALIVE void stepCar(float throttle, float brake, float steer, int handbrake)
{
	simulation->step(throttle, brake, steer, handbrake != 0);
}

EMSCRIPTEN_KEEPALIVE const float * carState()
{
	return simulation->readState();
}
}
