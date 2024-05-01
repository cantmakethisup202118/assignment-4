import vertexSrc from './vertex.glsl.js';
import fragmentSrc from './fragment.glsl.js';

var gl;

var layers = null

var modelMatrix;
var projectionMatrix;
var viewMatrix;

var currRotate = 0;
var currZoom = 0;
var currProj = 'perspective';


/*
    Vertex shader with uniform colors
*/
class LayerProgram {
    constructor() {
        this.vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSrc);
        this.fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
        this.program = createProgram(gl, this.vertexShader, this.fragmentShader);

        this.posAttribLoc = gl.getAttribLocation(this.program, "position");
        this.colorAttribLoc = gl.getUniformLocation(this.program, "uColor");
        this.modelLoc = gl.getUniformLocation(this.program, "uModel");
        this.projectionLoc = gl.getUniformLocation(this.program, "uProjection");
        this.viewLoc = gl.getUniformLocation(this.program, "uView");
        this.hasNormalsAttribLoc = gl.getUniformLocation(this.program, "uHasNormals");
    }

    use() {
        gl.useProgram(this.program);
    }
}


/*
    Collection of layers
*/
class Layers {
    constructor() {
        this.layers = {};
        this.centroid = [0,0,0];
    }

    addLayer(name, vertices, indices, color, normals) {
        if(normals == undefined)
            normals = null;
        var layer = new Layer(vertices, indices, color, normals);
        layer.init();
        this.layers[name] = layer;
        this.centroid = this.getCentroid();
    }

    removeLayer(name) {
        delete this.layers[name];
    }

    draw() {
        for(var layer in this.layers) {
            this.layers[layer].draw(this.centroid);
        }
    }

    
    getCentroid() {
        var sum = [0,0,0];
        var numpts = 0;
        for(var layer in this.layers) {
            numpts += this.layers[layer].vertices.length/3;
            for(var i=0; i<this.layers[layer].vertices.length; i+=3) {
                var x = this.layers[layer].vertices[i];
                var y = this.layers[layer].vertices[i+1];
                var z = this.layers[layer].vertices[i+2];
    
                sum[0]+=x;
                sum[1]+=y;
                sum[2]+=z;
            }
        }
        return [sum[0]/numpts,sum[1]/numpts,sum[2]/numpts];
    }
}

/*
    Layers without normals (water, parks, surface)
*/
class Layer {
    constructor(vertices, indices, color, normals = null) {
        this.vertices = vertices;
        this.indices = indices;
        this.color = color;
        this.normals = normals;

        this.hasNormals = false;
        if(this.normals) {
            this.hasNormals = true;
        }
    }

    init() {
        this.layerProgram = new LayerProgram();

        this.vertexBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(this.vertices));
        this.indexBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.indices));

        if(this.normals) {
            this.normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(this.normals));
            this.vao = createVAO(gl, 0, this.vertexBuffer, 1, this.normalBuffer);
        }
        else {
            this.vao = createVAO(gl, 0, this.vertexBuffer);
        }
    }

    draw(centroid) {
        this.layerProgram.use();

        updateModelMatrix(centroid);
        gl.uniformMatrix4fv(this.layerProgram.modelLoc, false, new Float32Array(modelMatrix));
    
        updateProjectionMatrix();
        gl.uniformMatrix4fv(this.layerProgram.projectionLoc, false, new Float32Array(projectionMatrix));
    
        updateViewMatrix(centroid);
        gl.uniformMatrix4fv(this.layerProgram.viewLoc, false, new Float32Array(viewMatrix));

        gl.uniform4fv(this.layerProgram.colorAttribLoc, this.color);
        gl.uniform1i(this.layerProgram.hasNormalsAttribLoc, this.hasNormals);

        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.drawElements(gl.TRIANGLES, this.indices.length, gl.UNSIGNED_INT, 0);
    }
}


/*
    Event handlers
*/
window.updateRotate = function() {
    currRotate = parseInt(document.querySelector("#rotate").value);
}

window.updateZoom = function() {
    currZoom = parseFloat(document.querySelector("#zoom").value);
}

window.updateProjection = function() {
    currProj = document.querySelector("#projection").value;
}

/*
    File handler
*/

function createBuilding(centerX, centerY, size, height, curIndex) {
    var halfSize = size/2; 

    var coordinates = [
        // Bottom face
        centerX - halfSize, centerY - halfSize, 0,
        centerX + halfSize, centerY - halfSize, 0,
        centerX + halfSize, centerY + halfSize, 0,
        centerX - halfSize, centerY + halfSize, 0,
        // Top face
        centerX - halfSize, centerY - halfSize, height,
        centerX + halfSize, centerY - halfSize, height,
        centerX + halfSize, centerY + halfSize, height,
        centerX - halfSize, centerY + halfSize, height
    ];
    var indices = [
        // Bottom face
        0, 1, 2, 0, 2, 3,
        // Top face
        4, 5, 6, 4, 6, 7,
        // Side faces
        0, 4, 5, 0, 5, 1,
        1, 5, 6, 1, 6, 2,
        2, 6, 7, 2, 7, 3,
        3, 7, 4, 3, 4, 0
    ];
    var normals = [];

    // TODO create faces of the building taking into account center point, size and height


    return {'coordinates': coordinates, 'indices': indices, 'normals': normals};


}

function buildGeometries(imgArray, width, height) {

    var geometries = {'surface': {'coordinates': [], 'indices': [], 'color': [0.9333333333333333, 0.9333333333333333, 0.9333333333333333, 1.0]},
                      'buildings': {'coordinates': [], 'indices': [], 'normals': [], 'color': [0.5, 0.6, 0.9, 1.0]}};

    // TODO loop through array and create building geometry according to red channel value
    var maxHeight = 500;
    var cellSize = 100;
    var buildingSize = 75;
    var curIndex = 0;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (x + y * width) * 4; // Assuming RGBA
            const redValue = imgArray[idx]; // Red channel for height
            const buildingHeight = (redValue / 255.0) * maxHeight;

            const centerX = (x - width / 2) * cellSize;
            const centerY = (y - height / 2) * cellSize;

            const building = createBuilding(centerX, centerY, buildingSize, buildingHeight);

            const updatedIndices = building.indices.map(index => index + curIndex);

            geometries.buildings.coordinates.push(...building.coordinates);
            geometries.buildings.indices.push(...building.indices.map(i => i + geometries.buildings.coordinates.length / 3));
            geometries.buildings.normals.push(...building.normals);

            curIndex += building.coordinates.length / 3; // Increment by the number of vertices added
        }
    }

    // Surface
    geometries['surface']['coordinates'] = [-width*cellSize/2.0,-height*cellSize/2.0,0,  width*cellSize/2.0,-height*cellSize/2.0,0, width*cellSize/2.0,height*cellSize/2.0,0, -width*cellSize/2.0,height*cellSize/2.0,0 ];
    geometries['surface']['indices'] = [0, 1, 2, 0, 2, 3];

    return geometries;
}

window.handleFile = function(e) {
    var img = new Image();
    img.onload = function() {
        console.log("Image loaded successfully.");
        var context = document.getElementById('image').getContext('2d');
        context.drawImage(img, 0, 0);
        var data = context.getImageData(0, 0, img.width, img.height).data;
        console.log("Image data extracted:", data);
        var geometries = buildGeometries(data, img.width, img.height);
        layers.addLayer('surface', geometries['surface']['coordinates'], geometries['surface']['indices'], geometries['surface']['color']);
        layers.addLayer('buildings', geometries['buildings']['coordinates'], geometries['buildings']['indices'], geometries['buildings']['color'], geometries['buildings']['normals']);
    };
    img.onerror = function() {
        console.error("Error loading the image.");
    };
    img.src = URL.createObjectURL(e.files[0]);
}

/*
    Update transformation matrices
*/

function updateProjectionMatrix() {


}

// Option 1: Rotating the model
function updateModelMatrix(centroid) {

}

function updateViewMatrix(centroid){

}

/*
    Main draw function (should call layers.draw)
*/
function draw() {

    gl.clearColor(190/255, 210/255, 215/255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    layers.draw();

    requestAnimationFrame(draw);

}

/*
    Initialize everything
*/
function initialize() {

    var canvas = document.querySelector("#glcanvas");
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    gl = canvas.getContext("webgl2");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);

    layers = new Layers();

    window.requestAnimationFrame(draw);

}


window.onload = initialize;