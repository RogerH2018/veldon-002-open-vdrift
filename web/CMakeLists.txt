cmake_minimum_required(VERSION 3.24)
project(veldon_vdrift_web LANGUAGES CXX)

if(NOT EMSCRIPTEN)
  message(FATAL_ERROR "Configure the web trial with emcmake.")
endif()

include(FetchContent)
FetchContent_Declare(bullet
  URL https://codeload.github.com/bulletphysics/bullet3/tar.gz/2c204c49e56ed15ec5fcfa71d199ab6d6570b3f5
  SOURCE_SUBDIR unused)
FetchContent_MakeAvailable(bullet)

set(BULLET_PHYSICS_SOURCE_DIR "${bullet_SOURCE_DIR}")
set(BULLET_VERSION 3.25)
foreach(library LinearMath BulletCollision BulletDynamics)
  add_subdirectory("${bullet_SOURCE_DIR}/src/${library}" "${library}")
endforeach()

set(vdrift "${CMAKE_CURRENT_LIST_DIR}/../src")
add_executable(engine
  simulation.cpp
  "${vdrift}/cfg/ptree_ini.cpp"
  "${vdrift}/linearinterp.cpp"
  "${vdrift}/loadcollisionshape.cpp"
  "${vdrift}/physics/cardynamics.cpp"
  "${vdrift}/physics/carengine.cpp"
  "${vdrift}/physics/carsuspension.cpp"
  "${vdrift}/physics/cartire3.cpp"
  "${vdrift}/physics/dynamicsworld.cpp"
  "${vdrift}/physics/fracturebody.cpp")
target_compile_features(engine PRIVATE cxx_std_17)
target_compile_definitions(engine PRIVATE VDRIFT_WEB VDRIFTP)
target_include_directories(engine PRIVATE "${vdrift}" "${bullet_SOURCE_DIR}/src")
target_link_libraries(engine PRIVATE BulletDynamics BulletCollision LinearMath)
target_link_options(engine PRIVATE
  --no-entry
  -sMODULARIZE=1
  -sEXPORT_ES6=1
  -sENVIRONMENT=web,node
  -sALLOW_MEMORY_GROWTH=1
  "-sEXPORTED_FUNCTIONS=['_malloc','_free']"
  "-sEXPORTED_RUNTIME_METHODS=['HEAPF32']")
set_target_properties(engine PROPERTIES SUFFIX ".mjs")
configure_file("${bullet_SOURCE_DIR}/LICENSE.txt" "${CMAKE_CURRENT_BINARY_DIR}/BULLET-LICENSE.txt" COPYONLY)
