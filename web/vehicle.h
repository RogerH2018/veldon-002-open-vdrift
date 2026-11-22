// SPDX-License-Identifier: GPL-3.0-or-later
#pragma once

// Original rear-wheel-drive club coupe for the Veldon browser trial.
constexpr char coupeConfig[] = R"ini(
[engine]
displacement = 0.0027
max-power = 205000
peak-engine-rpm = 6700
rpm-limit = 7400
inertia = 0.21
start-rpm = 1000
stall-rpm = 360
position = 0, 1.05, 0.19
mass = 163
torque-curve-00 = 850, 110
torque-curve-01 = 2200, 245
torque-curve-02 = 3700, 320
torque-curve-03 = 5100, 333
torque-curve-04 = 6500, 305
torque-curve-05 = 7400, 245

[clutch]
sliding = 0.32
max-pressure = 1100000
radius = 0.20
area = 0.013

[transmission]
gears = 5
gear-ratio-r = -3.05
gear-ratio-1 = 3.15
gear-ratio-2 = 2.10
gear-ratio-3 = 1.52
gear-ratio-4 = 1.16
gear-ratio-5 = 0.87
shift-time = 0.19

[fuel-tank]
capacity = 0.055
volume = 0.035
fuel-density = 745
position = 0, -0.91, 0.14

[differential-rear]
final-drive = 4.12
anti-slip = 240
anti-slip-torque = 120
anti-slip-torque-deceleration-factor = 0.6

[chassis]
mass = 980
position = 0, -0.12, 0.15
drag-coefficient = 0.32
frontal-area = 1.94

[chassis.box]
size = 1.65, 3.97, 0.61
center = 0, 0, 0.04
)ini";

constexpr char tireConfig[] = R"ini(
pt = 2.3
ktx = 690
kty = 710
kcb = 1800000
ccb = 0.5
cfy = 0.95
dz0 = 0.01
p0 = 2.0
mus = 1.34
muc = 0.96
vs = 4.0
cr0 = 0.011
cr2 = 0.000006
tread = 0.16
)ini";

inline PTree makeCoupeConfig()
{
	PTree config;
	std::istringstream carStream(coupeConfig);
	read_ini(carStream, config);

	const char * positions[] = {"fl", "fr", "rl", "rr"};
	for (int i = 0; i < 4; ++i)
	{
		const bool front = i < 2;
		const bool left = (i % 2) == 0;
		PTree & wheel = config.set(std::string("wheel.") + positions[i], PTree());
		wheel.set("position", front
			? (left ? "-0.79, 1.28, -0.04" : "0.79, 1.28, -0.04")
			: (left ? "-0.79, -1.25, -0.04" : "0.79, -1.25, -0.04"));
		wheel.set("camber", left ? 1.0 : -1.0);
		wheel.set("caster", front ? 5.0 : 0.0);
		wheel.set("toe", 0);
		wheel.set("steering", front ? 40 : 0);
		wheel.set("ackermann", front ? (left ? -12 : 12) : 0);

		PTree & tire = wheel.set("tire", PTree());
		tire.set("size", "225, 45, 17");
		tire.set("type", "club");

		PTree & hinge = wheel.set("hinge", PTree());
		hinge.set("chassis", "0, 0, 0");
		hinge.set("wheel", left ? "-0.38, 0, -0.04" : "0.38, 0, -0.04");

		PTree & coilover = wheel.set("coilover", PTree());
		coilover.set("spring-constant", front ? 45000 : 41000);
		coilover.set("bounce", 2800);
		coilover.set("rebound", 4700);
		coilover.set("travel", 0.16);
		coilover.set("anti-roll", front ? 11600 : 8300);

		PTree & brake = wheel.set("brake", PTree());
		brake.set("friction", 0.43);
		brake.set("max-pressure", 4400000);
		brake.set("radius", 0.14);
		brake.set("area", 0.00245);
		brake.set("bias", front ? 0.65 : 0.35);
		brake.set("handbrake", front ? 0 : 1);
	}
	return config;
}
