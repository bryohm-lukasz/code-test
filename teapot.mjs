// Client code for loading and rendering the teapot.
// This only needs to run on the latest version of Chrome.

/**
 * Loads the teapot geometry.
 * @returns {Promise<{indexes: Uint16Array, vertices: Float32Array}>}
 */
async function loadTeapotGeometry() {
  // Fetch the teapot obj file
  const teapotResponse = await fetch('/cow.obj');
  const teapotText = await teapotResponse.text();

  const vertices = [];
  const indexes = [];
  const normals = [];

  // Parse the obj file line by line
  for (const line of teapotText.split('\n')) {
    const parts = line.trim().split(' ');
    const type = parts[0];

    if (type === 'v') {
      const vertex = parts.slice(1).map(parseFloat);
      vertices.push(vertex);
    } else if (type === 'f') {
      const faceIndices = parts.slice(1).map((vertexData) => {
        return parseInt(vertexData.split('/')[0] - 1);
      });
      indexes.push(...faceIndices);
    } else if (type === 'vn') {
      const normal = parts.slice(1).map(parseFloat);
      normals.push(normal);
    }
  }

  return {
    indexes: new Uint16Array(indexes),
    vertices: new Float32Array(vertices.flat()),
    normals: new Float32Array(normals.flat()),
  };
}

/**
 * Sets up a shader program that renders a red object.
 * @param {WebGLRenderingContext} context
 * @returns {WebGLProgram}
 */
function setupShaderProgram(context) {
  const vertexShader = context.createShader(context.VERTEX_SHADER);
  const fragmentShader = context.createShader(context.FRAGMENT_SHADER);

  context.shaderSource(
    vertexShader,
    `
attribute vec3 position;
attribute vec3 normal;
uniform mat4 modelViewMatrix;
varying vec3 fragNormal;

void main() {
  gl_Position = modelViewMatrix * vec4(position, 1);
  fragNormal = normalize((modelViewMatrix * vec4(normal, 0)).xyz);
}
  `
  );

  console.log(context.getError());
  context.shaderSource(
    fragmentShader,
    `
precision mediump float;

varying vec3 fragNormal;

void main() {
  vec3 lightDirection = normalize(vec3(1.0, 1.0, 1.0));
  float intensity = max(dot(fragNormal, lightDirection), 0.0);

  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0) * intensity;
}

  `
  );
  context.compileShader(vertexShader);
  context.compileShader(fragmentShader);

  const program = context.createProgram();
  context.attachShader(program, vertexShader);
  context.attachShader(program, fragmentShader);
  context.linkProgram(program);

  return program;
}

async function renderTeapot() {
  // Create rendering context
  // https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext
  const canvas = document.getElementById('canvas');
  /** @type {WebGLRenderingContext} */
  const context = canvas.getContext('webgl');

  // Load teapot geometry
  const teapotGeometry = await loadTeapotGeometry();

  // Bind indexes to ELEMENT_ARRAY_BUFFER
  const index = context.createBuffer();
  context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, index);
  context.bufferData(context.ELEMENT_ARRAY_BUFFER, teapotGeometry.indexes, context.STATIC_DRAW);

  // Bind vertices to ARRAY_BUFFER
  const position = context.createBuffer();
  context.bindBuffer(context.ARRAY_BUFFER, position);
  context.bufferData(context.ARRAY_BUFFER, teapotGeometry.vertices, context.STATIC_DRAW);

  // Use the red shader program
  const program = setupShaderProgram(context);
  context.useProgram(program);

  // Bind position to it shader attribute
  const positionLocation = context.getAttribLocation(program, 'position');
  context.enableVertexAttribArray(positionLocation);
  context.vertexAttribPointer(positionLocation, 3, context.FLOAT, false, 0, 0);

  let firstFrame = performance.now();

  const renderLoop = () => {
    const delta = performance.now() - firstFrame;

    const normal = context.createBuffer();
    context.bindBuffer(context.ARRAY_BUFFER, normal);
    context.bufferData(context.ARRAY_BUFFER, teapotGeometry.normals, context.STATIC_DRAW);

    // Bind normal to shader attribute
    const normalLocation = context.getAttribLocation(program, 'normal');
    context.enableVertexAttribArray(normalLocation);
    context.vertexAttribPointer(normalLocation, 3, context.FLOAT, false, 0, 0);

    // Set a rotating model view matrix
    const modelViewMatrixLocation = context.getUniformLocation(program, 'modelViewMatrix');
    const rotation = rotationAngle;
    const scale = 0.3;
    context.uniformMatrix4fv(
      modelViewMatrixLocation,
      false,
      new Float32Array([
        scale * Math.cos(rotation),
        0,
        scale * Math.sin(rotation),
        0,
        0,
        scale,
        0,
        0,
        -scale * Math.sin(rotation),
        0,
        scale * Math.cos(rotation),
        0,
        0,
        0,
        0,
        1,
      ])
    );

    console.log(teapotGeometry.indexes.length);

    // Render the teapot
    context.drawElements(context.TRIANGLES, 17412, context.UNSIGNED_SHORT, 0);
    context.flush();

    // Request another frame
    requestAnimationFrame(renderLoop);
  };

  // Start the render loop
  requestAnimationFrame(renderLoop);
}

let rotationAngle = 0;
document.addEventListener('keydown', (event) => {
  const rotationSpeed = 0.19;

  switch (event.key) {
    case 'ArrowLeft':
      rotationAngle -= rotationSpeed;
      break;
    case 'ArrowRight':
      rotationAngle += rotationSpeed;
      break;
  }
});

renderTeapot();
