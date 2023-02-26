import {$} from "./common.js";
import * as THREE from "./three.module.js";
import {PointerLockControls} from "./PointerLockControls.js";
import {setupNetwork} from "./network.js"

let renderer;
let scene;
let camera;
let placementBrick;
let controls;

let brickPlacementRaycaster;

let floorGeo;
let floorMat;
let floor;

let networkState;

const brickWidth = 2;
const brickHeight = 1;
const brickDepth = 1;

const speedMultiplier = new THREE.Vector3(20, 20, 20);

let rendering = false;

let prevTime = performance.now();

const brickGeometry = new THREE.BoxGeometry(brickWidth, brickHeight, brickDepth);
const brickOutlineMat = new THREE.MeshBasicMaterial({color: 0x000000, wireframe: true});
const brickMaterial = new THREE.MeshBasicMaterial( { color: 0xbc4a3c } );
const placementBrickMaterial = new THREE.MeshBasicMaterial( { wireframe: true, color: 0xbc4a3c  } );

let topOfFloor;

export async function renderGame() {
    let gameContainer = $("#game-container");
    gameContainer.classList.remove("hidden");
    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0x87CEEB );
    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

    renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    gameContainer.appendChild(renderer.domElement);

    placementBrick = newBrick(new THREE.Vector3(5, 2, 0), false);
    placementBrick.material = placementBrickMaterial;
    camera.position.y = 5;

    controls = new PointerLockControls(camera, document.body);
    document.body.addEventListener("click", () => {
        if (!controls.isLocked) {
            controls.lock();
        }
    });

    rendering = true;

    floorGeo = new THREE.BoxGeometry(5000, 1, 5000);
    floorMat = new THREE.MeshBasicMaterial({color: 0xC2B280});
    floor = new THREE.Mesh(floorGeo, floorMat);
    scene.add(floor);

    // https://threejs.org/docs/#api/en/core/Raycaster

    topOfFloor = floor.position.y + (floor.geometry.parameters.height / 2);


    brickPlacementRaycaster = new THREE.Raycaster(...getCameraPosAndDir());

    networkState = await setupNetwork({
        onBrickAdd: onRemoteBrickAdd,
        onBrickRemove: onRemoteBrickRemove
    });

    $("body").addEventListener("mousedown", mouseHandler);
    setupMoveControls();

    animate();
}

function onRemoteBrickAdd(x, y, z) {
    let newRemoteBrickPos = new THREE.Vector3(x, y, z);
    newBrick(newRemoteBrickPos);
}

function onRemoteBrickRemove(x, y, z) {
    let deleteRemoteBrickPos = new THREE.Vector3(x, y, z);
    deleteBrick(deleteRemoteBrickPos);
}

function getCameraPosAndDir() {
    let worldPos = new THREE.Vector3();
    camera.getWorldPosition(worldPos);
    let worldDir = new THREE.Vector3();
    camera.getWorldDirection(worldDir);
    return [worldPos, worldDir];
}

let moveForward = false;
let moveLeft = false;
let moveRight = false;
let moveBackward = false;
let moveUp = false;
let moveDown = false;
function setupMoveControls() {
    const onKeyDown = function ( event ) {

        switch ( event.code ) {

            case 'ArrowUp':
            case 'KeyW':
                moveForward = true;
                break;

            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = true;
                break;

            case 'ArrowDown':
            case 'KeyS':
                moveBackward = true;
                break;

            case 'ArrowRight':
            case 'KeyD':
                moveRight = true;
                break;

            case 'Space':
                moveUp = true;
                break;

            case 'ShiftLeft':
                moveDown = true;
                break;
        }

    };

    const onKeyUp = function ( event ) {

        switch ( event.code ) {

            case 'ArrowUp':
            case 'KeyW':
                moveForward = false;
                break;

            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = false;
                break;

            case 'ArrowDown':
            case 'KeyS':
                moveBackward = false;
                break;

            case 'ArrowRight':
            case 'KeyD':
                moveRight = false;
                break;

            case 'Space':
                moveUp = false;
                break;

            case 'ShiftLeft':
                moveDown = false;
                break;
        }
    };
    $("body").addEventListener("keydown", onKeyDown);
    $("body").addEventListener("keyup", onKeyUp);
}

function processMovement(timeDelta) {
    let direction = new THREE.Vector3();
    direction.z = Number( moveForward ) - Number( moveBackward );
    direction.x = Number( moveRight ) - Number( moveLeft );
    direction.y = Number( moveUp ) - Number( moveDown );
    direction.normalize(); // this ensures consistent movements in all directions
    direction.multiply(speedMultiplier);
    controls.moveRight(direction.x * timeDelta);
    controls.moveForward(direction.z * timeDelta);
    camera.position.y += (direction.y * timeDelta);
    camera.position.y = Math.max(camera.position.y, topOfFloor + 1 /* dont clip pls :( */);
}

function newBrick(cornerPos, addToBricksList = true) {
    for (let brick of bricks) {
        if (getBrickCornerPos(brick).equals(cornerPos)) {
            return; // brick already exists
        }
    }

    let brick = new THREE.Mesh( brickGeometry, brickMaterial );
    brick.position.copy(cornerPos);
    brick.position.x += (brickWidth / 2);
    brick.position.y += (brickHeight / 2);
    brick.position.z += (brickDepth / 2);
    scene.add(brick);
    if (addToBricksList) {
         let brickOutline = new THREE.Mesh(brickGeometry, brickOutlineMat);
         brickOutline.position.copy(brick.position);
         scene.add(brickOutline);
         bricks.push(brick);
         brick.outline = brickOutline;
    } else {
        brick.outline = null;
    }
    return brick;
}

function getTargetedObjectAndCoords() {
    brickPlacementRaycaster.set(...getCameraPosAndDir());
    const intersects = brickPlacementRaycaster.intersectObjects([floor, ...bricks]);
    if (intersects.length === 0) return [null, null];
    const intersectData = intersects[0];

    let pos;
    if (intersectData.object === floor) {
        pos = posOnFloor(intersectData.point);
    } else {
        pos = posOnBrick(intersectData.object, intersectData.point);
    }

    return [intersectData.object, pos];
}

function posOnFloor(intersectionPosition) {
    // drawDot(intersectionPosition, 0x00FF00);

    const nearestBrickX = roundDownToNearest(intersectionPosition.x, brickWidth);
    const nearestBrickZ = roundDownToNearest(intersectionPosition.z, brickDepth);
    // const nearestBrickY = roundUpToNearest(intersectionPosition.y, brickDepth);
    // always place on floor
    const nearestBrickY = topOfFloor + (brickHeight / 2);
    return new THREE.Vector3(nearestBrickX, nearestBrickY, nearestBrickZ);
}

function posOnBrick(brick, intersectionPosition) {
    // drawDot(intersectionPosition, 0xFFFFFF);

    const nearestBrickX = roundToNearest(intersectionPosition.x, brickWidth);
    const nearestBrickZ = roundToNearest(intersectionPosition.z, brickDepth);
    let rightPos = brick.position.x + (brickWidth / 2);
    let leftPos = brick.position.x - (brickWidth / 2);
    let topPos = brick.position.y + (brickHeight / 2);
    let bottomPos = brick.position.y - (brickHeight / 2);
    let frontPos = brick.position.z + (brickDepth / 2);
    let backPos = brick.position.z - (brickDepth / 2);
    let newBrickOrigin = new THREE.Vector3(leftPos, bottomPos, backPos);

    if (intersectionPosition.y === topPos) {
        console.log("top");
        // top of brick!
        newBrickOrigin.y += brickHeight;
    } else if (intersectionPosition.y === bottomPos) {
        // bottom of brick. NO
        console.log("bottom :(");
        newBrickOrigin.y -= brickHeight;
    } else if (intersectionPosition.x === rightPos) {
        console.log("Other side");
        newBrickOrigin.x += brickWidth;
    } else if (intersectionPosition.x === leftPos) {
        newBrickOrigin.x -= brickWidth;
    } else if (intersectionPosition.z === frontPos) {
        newBrickOrigin.z += brickDepth;
    } else { // intersectionPosition.z === backPos
        newBrickOrigin.z -= brickDepth;
    }
    return newBrickOrigin;
}

function mouseHandler(mouseEvent) {
    if (mouseEvent.button === 0) {
        mousePlaceBrick();
    } else if (mouseEvent.button === 2){
        mouseRemoveBrick();
    }
}

function mousePlaceBrick() {
    let [targetedBrick, newBrickPos] = getTargetedObjectAndCoords();
    if (newBrickPos === null) return;
    const theNewBrick = newBrick(newBrickPos);
    networkState.onBrickAdd(newBrickPos.x, newBrickPos.y, newBrickPos.z);
}

function mouseRemoveBrick() {
    let [brickToDelete, removeBrickPos] = getTargetedObjectAndCoords();
    if (brickToDelete === floor) return;
    let brickCornerPos = getBrickCornerPos(brickToDelete);
    deleteBrick(brickCornerPos);
    networkState.onBrickRemove(brickCornerPos.x, brickCornerPos.y, brickCornerPos.z);
}

function getBrickCornerPos(brick) {
    return new THREE.Vector3(brick.position.x - (brickWidth / 2), brick.position.y - (brickHeight / 2) ,brick.position.z - (brickDepth / 2));
}

function deleteBrick(cornerPos) {
    let index = 0;
    for (let brick of bricks) {
        if (getBrickCornerPos(brick).equals(cornerPos)) {
            break;
        }
        index++;
    }
    if (index === bricks.length) {
        /* brick was already removed */ return;
    }
    let brick = bricks[index];

    scene.remove(brick);
    if (brick.outline !== null) scene.remove(brick.outline);
    bricks.splice(index, 1);
}

function drawDot(coords, color) {
    let dotGeometry = new THREE.BufferGeometry();
    dotGeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [0,0,0], 3 ) );
    let dotMaterial = new THREE.PointsMaterial( { size: 0.1, color: color } );
    let dot = new THREE.Points( dotGeometry, dotMaterial );
    dot.position.copy(coords);
    scene.add( dot );
}

let bricks = [];

window.
addEventListener("resize", windowResizeEvent => {
    if (renderer === undefined) return;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

function roundToNearest(number, multiple) {
    return Math.round(number / multiple) * multiple;
}
function roundUpToNearest(number, multiple) {
    return Math.ceil(number / multiple) * multiple;
}
function roundDownToNearest(number, multiple) {
    return Math.floor(number / multiple) * multiple;
}

function animate() {
	requestAnimationFrame( animate );
    let time = performance.now();
    processMovement((time - prevTime) / 1000);
    let [targetedObject, posOnFloor] = getTargetedObjectAndCoords();
    if (posOnFloor !== null) {
        placementBrick.position.copy(posOnFloor);
        placementBrick.position.x += (brickWidth / 2);
        placementBrick.position.y += (brickHeight / 2);
        placementBrick.position.z += (brickDepth / 2);
    }


	renderer.render( scene, camera );

    prevTime = time;
}
