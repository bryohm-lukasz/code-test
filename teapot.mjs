// Client code for loading and rendering the teapot.
// This only needs to run on the latest version of Chrome.

/**
 * Loads the teapot geometry.
 * @returns {Promise<{indexes: Uint16Array, vertices: Float32Array, normals: Floar32Array∂}>}
 */
async function loadTeapotGeometry() {
  // Fetch the teapot obj file
  const teapotResponse = await fetch('/teapot.obj');
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
    uniform mat4 perspectiveMatrix;
    varying vec3 fragNormal;

    void main() {
      gl_Position = perspectiveMatrix * modelViewMatrix * vec4(position, 1.0);
      fragNormal = normal;
    }
  `
  );
  context.shaderSource(
    fragmentShader,
    `
    precision mediump float;
    varying vec3 fragNormal;
    uniform vec3 uBaseColor;

    void main() {
          vec3 normal = normalize(fragNormal);
          vec3 lightDirection = normalize(vec3(0.0, 0.0, 1.0));
          float intensity = max(dot(normal, lightDirection), 0.0);
          vec3 finalColor = uBaseColor * intensity;

          gl_FragColor = vec4(finalColor, 1.0);
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

  const normal = context.createBuffer();
  context.bindBuffer(context.ARRAY_BUFFER, normal);
  context.bufferData(context.ARRAY_BUFFER, teapotGeometry.normals, context.STATIC_DRAW);

  // Use the red shader program
  const program = setupShaderProgram(context);
  context.useProgram(program);

  // Bind normal attribute to shader program
  const normalLocation = context.getAttribLocation(program, 'normal');
  context.enableVertexAttribArray(normalLocation);
  context.vertexAttribPointer(normalLocation, 3, context.FLOAT, false, 0, 0);

  // Bind position to it shader attribute
  const positionLocation = context.getAttribLocation(program, 'position');
  context.enableVertexAttribArray(positionLocation);
  context.bindBuffer(context.ARRAY_BUFFER, position);
  context.vertexAttribPointer(positionLocation, 3, context.FLOAT, false, 0, 0);

  const renderLoop = () => {
    const modelViewMatrixLocation = context.getUniformLocation(program, 'modelViewMatrix');
    const rotation = rotationAngle;
    const scale = 0.3;
    const translationZ = -5;
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
        translationZ,
        1,
      ])
    );

    // Set the perspective projection matrix
    const fov = Math.PI / 4;
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const near = 1;
    const far = 100;
    let projectionMatrix = perspectiveProjection(fov, aspect, near, far);
    const perspectiveMatrixLocation = context.getUniformLocation(program, 'perspectiveMatrix');
    context.uniformMatrix4fv(perspectiveMatrixLocation, false, new Float32Array(projectionMatrix));

    const baseColor = [1.0, 0.0, 0.0];
    context.uniform3fv(context.getUniformLocation(program, 'uBaseColor'), baseColor);

    context.drawElements(context.TRIANGLES, teapotGeometry.indexes.length, context.UNSIGNED_SHORT, 0);
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

/**
 * Constructs a perspective projection matrix.
 * @param {number} fov - The field of view angle in radians.
 * @param {number} aspect - The aspect ratio (width / height).
 * @param {number} near - The near clipping plane distance.
 * @param {number} far - The far clipping plane distance.
 * @returns {number[]} - The perspective projection matrix.
 */
function perspectiveProjection(fov, aspect, near, far) {
  const f = 1.0 / Math.tan(fov / 2.0);

  const projectionMatrix = [
    f / aspect,
    0,
    0,
    0,
    0,
    f,
    0,
    0,
    0,
    0,
    (far + near) / (near - far),
    -1,
    0,
    0,
    (2 * far * near) / (near - far),
    0,
  ];

  return projectionMatrix;
}

renderTeapot();
