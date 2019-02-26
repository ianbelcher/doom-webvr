AFRAME.registerComponent('sector', {
  schema: {
    vertices: {
      default: ['-10 10', '-10 -10', '10 -10'],
    },
    height: { default: 10 },
    face: { default: 'floor' },
  },

  init: function () {
    const { data } = this;

    const pts = [];
    for (let i = 0; i < data.vertices.length; i++) {
      const points = data.vertices[i].split(' ').map(x => parseFloat(x));
      pts.push(new THREE.Vector2(points[0], points[1] * (this.data.face === 'floor' ? -1 : 1)));
    }
    const shape = new THREE.Shape(pts);

    const extrudeSettings = {
      depth: 0,
      steps: 0,
      bevelEnabled: false,
      // bevelEnabled: true, bevelSegments: 8, steps: 8, bevelSize: 0.1, bevelThickness: 0.1 
    };
    this.geometry = new THREE.ExtrudeBufferGeometry(shape, extrudeSettings);
    this.geometry.lookAt(new THREE.Vector3(0, this.data.face === 'ceiling' ? 10000 : -10000, 0));
    this.mesh = new THREE.Mesh(this.geometry);
    this.mesh.position.y = this.data.height;
    this.el.setObject3D('mesh', this.mesh);
  }
});

AFRAME.registerComponent('sprite', {
  schema: {
    assets: { default: '' },
  },

  init: function () {
    const { data } = this;
    const assets = data.assets.split(':');
    const files = assets.map(i => `assets/${i}.png`);

    this.textureLoader = new THREE.TextureLoader();
    this.map = this.textureLoader.load(files[0]);
    this.material = new THREE.SpriteMaterial({
      map: this.map
    });
    this.sprite = new THREE.Sprite(this.material);

    const { width, height } = map.assetSizes[assets[0]];
    const valueX = SIZE_FACTOR * width;
    const valueY = SIZE_FACTOR * height;

    this.sprite.scale.set(valueX, valueY, 0);

    this.el.setObject3D('mesh', this.sprite);
  }
});


const updateSpriteAngles = ({ x: cx, z: cz }) => {
  sprites && sprites.forEach((sprite, index) => {
    const { x: sx, z: sz } = sprite.getAttribute('position');
    const angle = Math.atan2(cx - sx, cz - sz);
    // const angle = Math.atan2( (cx + map.startPosition.x) - sx, (cz - map.startPosition.z) - sz );
    sprite.object3D.rotation.y = angle;
  });
}
let sprites;
let wasdDisabled = false;
AFRAME.registerComponent('listener', {
  tick: function () {
    if (typeof map !== 'undefined' && typeof sprites !== 'undefined' && !wasdDisabled) {
      const position = this.el.getAttribute('position');
      updateSpriteAngles({ x: position.x + map.startPosition.x, z: position.z + (map.startPosition.z * -1) });
    }
  }
});

const run = () => {

  document.getElementById('levelSelect').addEventListener('change', event => {
    window.location = `/?level=${event.target.value}`
  })

  const SIZE_FACTOR = 0.0625;

  const skyBoxDefinition = [
    ['FR', '0 0 -1000', '0 0 0', 4000],
    ['BK', '0 0 1000', '0 180 0', 4000],
    ['RT', '-1000 0 0', '0 90 0', 4000],
    ['LF', '1000 0 0', '0 -90 0', 4000],
    ['UP', '0 2000 0', '270 0 0', 2000],
    ['DN', '0 -2000 0', '-90 0 0', 2000],
  ]
  skyBoxDefinition.forEach(([imageSuffix, position, rotation, height]) => {
    const skyImage = document.createElement('a-image');
    skyImage.setAttribute('position', position);
    skyImage.setAttribute('rotation', rotation);
    skyImage.setAttribute('width', 2000);
    skyImage.setAttribute('height', height);
    skyImage.setAttribute('class', `sky`);
    skyImage.setAttribute('src', `skys/0${map.skyNumber}_${imageSuffix}.png`);
    document.querySelector('a-scene').appendChild(skyImage);
  });

  const cameraRigElement = document.getElementById('cameraRig');
  cameraRigElement.setAttribute('position', `${map.startPosition.x} ${map.startPosition.y || 1.5} ${map.startPosition.z * -1}`);
  cameraRigElement.setAttribute('rotation', `0 ${map.startPosition.angle} 0`);
  cameraRigElement.addEventListener('teleported', event => {
    wasdDisabled = true;
    updateSpriteAngles(event.detail.newPosition);
  });

  const addFloorsAndCeilings = () => {
    const { polygons } = map;
    // .filter(d => d.sectorId === 28);

    for (let sectorIndex = 0; sectorIndex < polygons.length; sectorIndex += 1) {
      const { floor, ceiling, floorHeight, ceilingHeight, polygon, isSky } = polygons[sectorIndex];
      const vertices = polygon.map(polygon => `${polygon[0]} ${polygon[1]}`).join(', ');

      const floorPolygon = document.createElement('a-entity');
      floorPolygon.setAttribute('sector', `vertices: ${vertices}; height: ${floorHeight}; face: floor;`);
      // floorPolygon.setAttribute('material', `color: #fff; side: front;`);
      floorPolygon.setAttribute('material', `shader: flat; src: assets/${floor}.png; side: front; repeat: 0.325 0.325;`);
      // floorPolygon.setAttribute('wireframe', true);
      floorPolygon.setAttribute('class', `floor`);
      document.querySelector('a-scene').appendChild(floorPolygon);

      if (!isSky) {
        const ceilingPolygon = document.createElement('a-entity');
        ceilingPolygon.setAttribute('sector', `vertices: ${vertices}; height: ${ceilingHeight}; face: ceiling;`);
        ceilingPolygon.setAttribute('material', `shader: flat; src: assets/${ceiling}.png; side: front; repeat: 0.325 0.325;`);
        // ceilingPolygon.setAttribute('wireframe', true);
        ceilingPolygon.setAttribute('class', `ceiling`);
        document.querySelector('a-scene').appendChild(ceilingPolygon);
      }
    }
  }
  addFloorsAndCeilings();

  const addWalls = () => {
    for (let planeIndex = 0; planeIndex < map.planes.length; planeIndex += 1) {
      const { width, x, y, z, height, rotation, src } = map.planes[planeIndex];

      const assetSizes = map.assetSizes[src];
      if (!assetSizes) {
        console.log(`Missing asset of ${src}`);
        continue;
      }
      const { width: imageWidth, height: imageHeight } = assetSizes;
      const xRepeat = (width / imageWidth) / SIZE_FACTOR;
      const yRepeat = (height / imageHeight) / SIZE_FACTOR;

      if (height > 0.0001) {
        const wallPlane = document.createElement('a-plane');
        wallPlane.setAttribute('position', `${x} ${y} ${z * -1}`);
        wallPlane.setAttribute('rotation', `0 ${rotation * (180 / Math.PI)} 0`);
        wallPlane.setAttribute('width', width);
        wallPlane.setAttribute('height', height);
        wallPlane.setAttribute('material', `src: assets/${src}.png; side: both; repeat: ${xRepeat} ${yRepeat}; alphaTest: 0.9;`);
        wallPlane.setAttribute('class', `wall`);
        document.querySelector('a-scene').appendChild(wallPlane);
      }
    }
  }
  addWalls();

  const addSprites = () => {
    const sprites = [];
    for (let spriteIndex = 0; spriteIndex < map.sprites.length; spriteIndex += 1) {
      const { x, y, z, src, size, angle } = map.sprites[spriteIndex];

      const { width, height } = map.assetSizes[src[0].replace('.png', '')];

      const sprite = document.createElement('a-image');
      sprite.setAttribute('id', `sprite-${spriteIndex}`);
      sprite.setAttribute('position', `${x} ${y} ${z * -1}`);
      sprite.setAttribute('rotation', `0 0 0`);
      sprite.setAttribute('width', SIZE_FACTOR * width);
      sprite.setAttribute('height', SIZE_FACTOR * height);
      sprite.setAttribute('src', `assets/${src[0].replace('.png', '')}.png`);
      // sprite.setAttribute('material', `src: assets/${src[0].replace('.png', '')}.png; side: both; alphaTest: 0.99;`);
      sprite.setAttribute('class', `sprite`);
      document.querySelector('a-scene').appendChild(sprite);
      sprites.push(sprite);
    }
    return sprites;
  }
  sprites = addSprites();

}