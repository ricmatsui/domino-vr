import React from 'react';
import './App.css';
import { Select, VRCanvas, DefaultXRControllers } from '@react-three/xr';
import { Controls, withControls } from 'react-three-gui';
import { Text } from '@react-three/drei';
import { Physics, useBox } from '@react-three/cannon'
import _ from 'lodash';
import * as THREE from 'three'
import { useFrame } from 'react-three-fiber'

const DOMINO_SIZE = [0.375, 0.75, 0.075];

const TOOL_OFFSET = new THREE.Vector3(0, 0.05, -0.05);

const PlayField = () => {
  const [dominoes, setDominoes] = React.useState([]);
  const [debug, setDebug] = React.useState('Debug');

  const [debugRotation, setDebugRotation] = React.useState(null);
  const [debugPosition, setDebugPosition] = React.useState(null);

  const [startPosition, setStartPosition] = React.useState(null);
  const [endPosition, setEndPosition] = React.useState(null);

  const [tool, setTool] = React.useState('domino');

  const toolRef = React.useRef(null);

  const controllerRef = React.useRef(null);

  useFrame(
    React.useCallback(() => {
      if (!controllerRef.current) {
        return;
      }

      setDebug(JSON.stringify({
        buttons: controllerRef.current.inputSource.gamepad.buttons.map((button) => button.pressed),
        length: controllerRef.current.hoverRayLength,
        axes: controllerRef.current.inputSource.gamepad.axes,
        angle: new THREE.Vector2(
          controllerRef.current.inputSource.gamepad.axes[2],
          controllerRef.current.inputSource.gamepad.axes[3],
        ).angle(),
      }, null, 4));
    }, [
      controllerRef,
      setDebug,
    ])
  );

  useFrame(
    React.useCallback(() => {
      if (!toolRef.current || !controllerRef.current) {
        return;
      }

      toolRef.current.position.copy(controllerRef.current.controller.position);
      toolRef.current.position.add(TOOL_OFFSET);
    }, [
      controllerRef,
      toolRef,
    ])
  );

  const previousGamepadStateRef = React.useRef(null);
  const gamepadStateRef = React.useRef(null);

  const [dominoRunId, setDominoRunId] = React.useState('initial');

  const restartDominoes = React.useCallback(() => {
    setDominoRunId(_.uniqueId('dominoRun_'));
  }, [setDominoRunId]);

  useFrame(
    React.useCallback(() => {
      if (!controllerRef.current) {
        return;
      }

      const joystick = new THREE.Vector2(
        controllerRef.current.inputSource.gamepad.axes[2],
        controllerRef.current.inputSource.gamepad.axes[3],
      );

      let tool = 'domino';

      if (joystick.length() > 0.5) {
        const tools = [
          'undo',
          'reset',
        ];

        tool = tools[Math.floor(joystick.angle() / (2 * Math.PI) * tools.length)];
      }

      gamepadStateRef.current = {
        click: controllerRef.current.inputSource.gamepad.buttons[0].pressed,
        x: joystick.x,
        y: joystick.y,
        tool,
      };

      if (previousGamepadStateRef.current) {
        if (gamepadStateRef.current.click && !previousGamepadStateRef.current.click) {
          if (tool === 'reset') {
            restartDominoes();
          }

          if (tool === 'undo') {
            setDominoes(dominoes.slice(0, -1));
          }
        }

        if (gamepadStateRef.current.tool !== !previousGamepadStateRef.current.tool) {
          setTool(tool);
        }
      }

      previousGamepadStateRef.current = { ...gamepadStateRef.current };
    }, [
      previousGamepadStateRef,
      gamepadStateRef,
      restartDominoes,
      setTool,
      setDominoes,
      dominoes,
    ])
  );

  const onSelect = React.useCallback((event) => {
    const selectedPosition = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(event.controller.controller.quaternion)
      .multiplyScalar(event.controller.hoverRayLength)
      .add(event.controller.controller.position);

    controllerRef.current = event.controller;

    if (!gamepadStateRef.current) {
      return;
    }

    if (new THREE.Vector2(gamepadStateRef.current.x, gamepadStateRef.current.y)
      .length() > 0.5) {
      return;
    }

    if (!startPosition) {
      setStartPosition(selectedPosition);
      return;
    }

    const startRotated = event.controller.inputSource.gamepad.buttons[5].pressed;

    const endPosition = selectedPosition;

    setEndPosition(endPosition);

    const quaternion = new THREE.Quaternion();

    quaternion.multiply(new THREE.Quaternion()
      .setFromAxisAngle(
        new THREE.Vector3(0, -1, 0)
          .normalize(),
        new THREE.Vector2(endPosition.x - startPosition.x, endPosition.z - startPosition.z)
          .angle()
          - Math.PI / 2
      )
    );

    if (startRotated) {
      quaternion.multiply(new THREE.Quaternion()
        .setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          Math.PI / 8
        )
      );
    }

    const rotation = new THREE.Euler()
      .setFromQuaternion(quaternion)
      .toArray()
      .slice(0, 3);

    setDebugRotation(new THREE.Quaternion()
      .setFromEuler(new THREE.Euler()
        .fromArray(rotation)));
    setDebugPosition(startPosition);

    const newCount = startRotated ? 1 : startPosition.distanceTo(endPosition) * 2;

    const newDominoes = _.range(newCount)
      .map((index) => {
        return {
          id: _.uniqueId('domino_'),
          position: new THREE.Vector3()
            .add(startPosition)
            .lerp(endPosition, index / newCount)
            .add(new THREE.Vector3(0, DOMINO_SIZE[1]/2, 0))
            .toArray(),
          rotation,
        }
      });

    setDominoes([
      ...event.controller.inputSource.gamepad.buttons[4].pressed ? [] : dominoes,
      ...newDominoes,
    ]);

    setStartPosition(null);
  }, [
    setDebugRotation,
    dominoes,
    setDominoes,
    controllerRef,
    setStartPosition,
    setEndPosition,
    startPosition,
    setDebugPosition,
  ]);

  return (
    <React.Fragment>
      <Select onSelect={onSelect}>
        <Ground color='#3CCC00' />
      </Select>
      {dominoes.map((domino) => (
        <Domino key={dominoRunId + domino.id} domino={domino} />
      ))}
      <Text
        ref={toolRef}
        fontSize={0.05}
        color='white'
        anchorX='center'
        anchorY='middle'>
        {tool}
      </Text>
      <Text
        position={[0, 3, -7]}
        color='white'
        anchorX='center'
        anchorY='middle'>
        {debug}
      </Text>
      {!startPosition ? null : (
        <DebugCube position={startPosition} color='red' />
      )}
      {!endPosition ? null : (
        <DebugCube position={endPosition} color='blue' />
      )}
      {!debugRotation || !debugPosition ? null : (
        <DebugCone
          position={debugPosition}
          quaternion={debugRotation}
          color='green' />
      )}
    </React.Fragment>
  );
}

const Ground = ({ color }) => {
  const [ref] = useBox(() => ({
    mass: 0,
    args: [10, 1, 10],
    position: [0, -0.5, 0],
  }));

  return (
    <mesh ref={ref}>
      <boxBufferGeometry args={[10, 1, 10]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
};

const DebugCube = ({ color, position, quaternion }) => {
  return (
    <mesh position={position} quaternion={quaternion}>
      <boxBufferGeometry args={[0.2, 0.2, 0.2]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
};

const CONE_QUATERNION = new THREE.Quaternion()
  .setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    Math.PI / 2
  );

const DebugCone = ({ color, position, quaternion }) => {
  return (
    <group position={position} quaternion={quaternion}>
      <mesh quaternion={CONE_QUATERNION}>
        <coneBufferGeometry args={[0.1, 0.3, 10]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
};


const Domino = ({ domino }) => {
  const [ref] = useBox(() => ({
    mass: 1,
    material: {
      friction: 0.1,
      restitution: 0,
    },
    args: DOMINO_SIZE,
    position: domino.position,
    rotation: domino.rotation,
  }))

  return (
    <mesh ref={ref}>
      <boxBufferGeometry args={DOMINO_SIZE} />
      <meshStandardMaterial color='#CCCCFF' />
    </mesh>
  );
};

const Canvas = withControls(VRCanvas);

function App() {
  return (
    <Controls.Provider>
      <Canvas>
        <DefaultXRControllers />
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        <Physics>
          <PlayField />
        </Physics>
      </Canvas>
      <Controls />
    </Controls.Provider>
  );
}

export default App;
