import React from 'react';
import './App.css';
import { Select, VRCanvas, DefaultXRControllers } from '@react-three/xr';
import { Controls, withControls } from 'react-three-gui';
import { Text } from '@react-three/drei';
import { Physics, useBox } from '@react-three/cannon'
import _ from 'lodash';
import * as THREE from 'three'

const DOMINO_SIZE = [0.375, 0.75, 0.075];

const PlayField = () => {
  const [dominoes, setDominoes] = React.useState([]);
  const [debug, setDebug] = React.useState('Debug');

  const [debugRotation, setDebugRotation] = React.useState(null);
  const [debugPosition, setDebugPosition] = React.useState(null);

  const [startPosition, setStartPosition] = React.useState(null);
  const [endPosition, setEndPosition] = React.useState(null);

  const onSelect = React.useCallback((event) => {
    const selectedPosition = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(event.controller.controller.quaternion)
      .multiplyScalar(event.controller.hoverRayLength)
      .add(event.controller.controller.position);

    setDebug(JSON.stringify(
      {
        pressed: event.controller.inputSource.gamepad.buttons[5].pressed,
      },
      null,
      4
    ));

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
    setDebug,
    setDebugRotation,
    dominoes,
    setDominoes,
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
        <Domino key={domino.id} domino={domino} />
      ))}
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
