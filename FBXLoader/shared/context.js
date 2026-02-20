/**
 * Shared context for FBX loading
 * Manages global state that's shared across parser modules
 */

let fbxTree = null;
let connections = null;
let sceneGraph = null;

export function getFbxTree() {
	return fbxTree;
}

export function setFbxTree(tree) {
	fbxTree = tree;
}

export function getConnections() {
	return connections;
}

export function setConnections(conn) {
	connections = conn;
}

export function getSceneGraph() {
	return sceneGraph;
}

export function setSceneGraph(graph) {
	sceneGraph = graph;
}

export function resetContext() {
	fbxTree = null;
	connections = null;
	sceneGraph = null;
}
