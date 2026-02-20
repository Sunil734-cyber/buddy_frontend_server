/**
 * Animation parser for FBX files
 * Parses animation curve data and creates Three.js animation clips
 */

import {
	AnimationClip,
	VectorKeyframeTrack,
	QuaternionKeyframeTrack,
	NumberKeyframeTrack,
	Euler,
	Quaternion,
	Vector3,
	Matrix4,
	MathUtils,
	PropertyBinding
} from 'three';
import { getFbxTree, getConnections, getSceneGraph } from '../shared/context.js';
import { convertFBXTimeToSeconds, inject } from '../utils/dataUtils.js';

export class AnimationParser {
	// take raw animation clips and turn them into three.js animation clips
	parse() {
		const animationClips = [];

		const rawClips = this.parseClips();

		if (rawClips !== undefined) {
			for (const key in rawClips) {
				const rawClip = rawClips[key];

				const clip = this.addClip(rawClip);

				animationClips.push(clip);
			}
		}

		return animationClips;
	}

	parseClips() {
		const fbxTree = getFbxTree();
		
		// since the actual transformation data is stored in FBXTree.Objects.AnimationCurve,
		// if this is undefined we can safely assume there are no animations
		if (fbxTree.Objects.AnimationCurve === undefined) return undefined;

		const curveNodesMap = this.parseAnimationCurveNodes();

		this.parseAnimationCurves(curveNodesMap);

		const layersMap = this.parseAnimationLayers(curveNodesMap);
		const rawClips = this.parseAnimStacks(layersMap);

		return rawClips;
	}

	// parse nodes in FBXTree.Objects.AnimationCurveNode
	// each AnimationCurveNode holds data for an animation transform for a model (e.g. left arm rotation )
	// and is referenced by an AnimationLayer
	parseAnimationCurveNodes() {
		const fbxTree = getFbxTree();
		const rawCurveNodes = fbxTree.Objects.AnimationCurveNode;

		const curveNodesMap = new Map();

		for (const nodeID in rawCurveNodes) {
			const rawCurveNode = rawCurveNodes[nodeID];

			if (rawCurveNode.attrName.match(/S|R|T|DeformPercent/) !== null) {
				const curveNode = {
					id: rawCurveNode.id,
					attr: rawCurveNode.attrName,
					curves: {},
				};

				curveNodesMap.set(curveNode.id, curveNode);
			}
		}

		return curveNodesMap;
	}

	// parse nodes in FBXTree.Objects.AnimationCurve and connect them up to
	// previously parsed AnimationCurveNodes. Each AnimationCurve holds data for a single animated
	// axis ( e.g. times and values of x rotation)
	parseAnimationCurves(curveNodesMap) {
		const fbxTree = getFbxTree();
		const connections = getConnections();
		const rawCurves = fbxTree.Objects.AnimationCurve;

		// TODO: Many values are identical up to roundoff error, but won't be optimised
		// e.g. position times: [0, 0.4, 0. 8]
		// position values: [7.23538335023477e-7, 93.67518615722656, -0.9982695579528809, 7.23538335023477e-7, 93.67518615722656, -0.9982695579528809, 7.235384487103147e-7, 93.67520904541016, -0.9982695579528809]
		// clearly, this should be optimised to
		// times: [0], positions [7.23538335023477e-7, 93.67518615722656, -0.9982695579528809]
		// this shows up in nearly every FBX file, and generally time array is length > 100

		for (const nodeID in rawCurves) {
			const animationCurve = {
				id: rawCurves[nodeID].id,
				times: rawCurves[nodeID].KeyTime.a.map(convertFBXTimeToSeconds),
				values: rawCurves[nodeID].KeyValueFloat.a,
			};

			const relationships = connections.get(animationCurve.id);

			if (relationships !== undefined) {
				const animationCurveID = relationships.parents[0].ID;
				const animationCurveRelationship = relationships.parents[0].relationship;

				if (animationCurveRelationship.match(/X/)) {
					curveNodesMap.get(animationCurveID).curves['x'] = animationCurve;
				} else if (animationCurveRelationship.match(/Y/)) {
					curveNodesMap.get(animationCurveID).curves['y'] = animationCurve;
				} else if (animationCurveRelationship.match(/Z/)) {
					curveNodesMap.get(animationCurveID).curves['z'] = animationCurve;
				} else if (animationCurveRelationship.match(/DeformPercent/) && curveNodesMap.has(animationCurveID)) {
					curveNodesMap.get(animationCurveID).curves['morph'] = animationCurve;
				}
			}
		}
	}

	// parse nodes in FBXTree.Objects.AnimationLayer. Each layers holds references
	// to various AnimationCurveNodes and is referenced by an AnimationStack node
	// note: theoretically a stack can have multiple layers, however in practice there always seems to be one per stack
	parseAnimationLayers(curveNodesMap) {
		const fbxTree = getFbxTree();
		const connections = getConnections();
		const sceneGraph = getSceneGraph();
		const rawLayers = fbxTree.Objects.AnimationLayer;

		const layersMap = new Map();

		for (const nodeID in rawLayers) {
			const layerCurveNodes = [];

			const connection = connections.get(parseInt(nodeID));

			if (connection !== undefined) {
				// all the animationCurveNodes used in the layer
				const children = connection.children;

				children.forEach(function (child, i) {
					if (curveNodesMap.has(child.ID)) {
						const curveNode = curveNodesMap.get(child.ID);

						// check that the curves are defined for at least one axis, otherwise ignore the curveNode
						if (curveNode.curves.x !== undefined || curveNode.curves.y !== undefined || curveNode.curves.z !== undefined) {
							if (layerCurveNodes[i] === undefined) {
								const modelID = connections.get(child.ID).parents.filter(function (parent) {
									return parent.relationship !== undefined;
								})[0].ID;

								if (modelID !== undefined) {
									const rawModel = fbxTree.Objects.Model[modelID.toString()];

									if (rawModel === undefined) {
										console.warn('THREE.FBXLoader: Encountered a unused curve.', child);
										return;
									}

									const node = {
										modelName: rawModel.attrName ? PropertyBinding.sanitizeNodeName(rawModel.attrName) : '',
										ID: rawModel.id,
										initialPosition: [0, 0, 0],
										initialRotation: [0, 0, 0],
										initialScale: [1, 1, 1],
									};

									sceneGraph.traverse(function (child) {
										if (child.ID === rawModel.id) {
											node.transform = child.matrix;

											if (child.userData.transformData) node.eulerOrder = child.userData.transformData.eulerOrder;
										}
									});

									if (!node.transform) node.transform = new Matrix4();

									// if the animated model is pre rotated, we'll have to apply the pre rotations to every
									// animation value as well
									if ('PreRotation' in rawModel) node.preRotation = rawModel.PreRotation.value;
									if ('PostRotation' in rawModel) node.postRotation = rawModel.PostRotation.value;

									layerCurveNodes[i] = node;
								}
							}

							if (layerCurveNodes[i]) layerCurveNodes[i][curveNode.attr] = curveNode;
						} else if (curveNode.curves.morph !== undefined) {
							if (layerCurveNodes[i] === undefined) {
								const deformerID = connections.get(child.ID).parents.filter(function (parent) {
									return parent.relationship !== undefined;
								})[0].ID;

								const morpherID = connections.get(deformerID).parents[0].ID;
								const geoID = connections.get(morpherID).parents[0].ID;

								// assuming geometry is not used in more than one model
								const modelID = connections.get(geoID).parents[0].ID;

								const rawModel = fbxTree.Objects.Model[modelID];

								const node = {
									modelName: rawModel.attrName ? PropertyBinding.sanitizeNodeName(rawModel.attrName) : '',
									morphName: fbxTree.Objects.Deformer[deformerID].attrName,
								};

								layerCurveNodes[i] = node;
							}

							layerCurveNodes[i][curveNode.attr] = curveNode;
						}
					}
				});

				layersMap.set(parseInt(nodeID), layerCurveNodes);
			}
		}

		return layersMap;
	}

	// parse nodes in FBXTree.Objects.AnimationStack. These are the top level node in the animation
	// hierarchy. Each Stack node will be used to create a AnimationClip
	parseAnimStacks(layersMap) {
		const fbxTree = getFbxTree();
		const connections = getConnections();
		const rawStacks = fbxTree.Objects.AnimationStack;

		// connect the stacks (clips) up to the layers
		const rawClips = {};

		for (const nodeID in rawStacks) {
			const children = connections.get(parseInt(nodeID)).children;

			if (children.length > 1) {
				// it seems like stacks will always be associated with a single layer. But just in case there are files
				// where there are multiple layers per stack, we'll display a warning
				console.warn('THREE.FBXLoader: Encountered an animation stack with multiple layers, this is currently not supported. Ignoring subsequent layers.');
			}

			const layer = layersMap.get(children[0].ID);

			rawClips[nodeID] = {
				name: rawStacks[nodeID].attrName,
				layer: layer,
			};
		}

		return rawClips;
	}

	addClip(rawClip) {
		let tracks = [];

		const scope = this;
		rawClip.layer.forEach(function (rawTracks) {
			tracks = tracks.concat(scope.generateTracks(rawTracks));
		});

		return new AnimationClip(rawClip.name, -1, tracks);
	}

	generateTracks(rawTracks) {
		const tracks = [];

		let initialPosition = new Vector3();
		let initialRotation = new Quaternion();
		let initialScale = new Vector3();

		if (rawTracks.transform) rawTracks.transform.decompose(initialPosition, initialRotation, initialScale);

		initialPosition = initialPosition.toArray();
		initialRotation = new Euler().setFromQuaternion(initialRotation, rawTracks.eulerOrder).toArray();
		initialScale = initialScale.toArray();

		if (rawTracks.T !== undefined && Object.keys(rawTracks.T.curves).length > 0) {
			const positionTrack = this.generateVectorTrack(rawTracks.modelName, rawTracks.T.curves, initialPosition, 'position');
			if (positionTrack !== undefined) tracks.push(positionTrack);
		}

		if (rawTracks.R !== undefined && Object.keys(rawTracks.R.curves).length > 0) {
			const rotationTrack = this.generateRotationTrack(rawTracks.modelName, rawTracks.R.curves, initialRotation, rawTracks.preRotation, rawTracks.postRotation, rawTracks.eulerOrder);
			if (rotationTrack !== undefined) tracks.push(rotationTrack);
		}

		if (rawTracks.S !== undefined && Object.keys(rawTracks.S.curves).length > 0) {
			const scaleTrack = this.generateVectorTrack(rawTracks.modelName, rawTracks.S.curves, initialScale, 'scale');
			if (scaleTrack !== undefined) tracks.push(scaleTrack);
		}

		if (rawTracks.DeformPercent !== undefined) {
			const morphTrack = this.generateMorphTrack(rawTracks);
			if (morphTrack !== undefined) tracks.push(morphTrack);
		}

		return tracks;
	}

	generateVectorTrack(modelName, curves, initialValue, type) {
		const times = this.getTimesForAllAxes(curves);
		const values = this.getKeyframeTrackValues(times, curves, initialValue);

		return new VectorKeyframeTrack(modelName + '.' + type, times, values);
	}

	generateRotationTrack(modelName, curves, initialValue, preRotation, postRotation, eulerOrder) {
		if (curves.x !== undefined) {
			this.interpolateRotations(curves.x);
			curves.x.values = curves.x.values.map(MathUtils.degToRad);
		}

		if (curves.y !== undefined) {
			this.interpolateRotations(curves.y);
			curves.y.values = curves.y.values.map(MathUtils.degToRad);
		}

		if (curves.z !== undefined) {
			this.interpolateRotations(curves.z);
			curves.z.values = curves.z.values.map(MathUtils.degToRad);
		}

		const times = this.getTimesForAllAxes(curves);
		const values = this.getKeyframeTrackValues(times, curves, initialValue);

		if (preRotation !== undefined) {
			preRotation = preRotation.map(MathUtils.degToRad);
			preRotation.push(eulerOrder);

			preRotation = new Euler().fromArray(preRotation);
			preRotation = new Quaternion().setFromEuler(preRotation);
		}

		if (postRotation !== undefined) {
			postRotation = postRotation.map(MathUtils.degToRad);
			postRotation.push(eulerOrder);

			postRotation = new Euler().fromArray(postRotation);
			postRotation = new Quaternion().setFromEuler(postRotation).invert();
		}

		const quaternion = new Quaternion();
		const euler = new Euler();

		const quaternionValues = [];

		for (let i = 0; i < values.length; i += 3) {
			euler.set(values[i], values[i + 1], values[i + 2], eulerOrder);

			quaternion.setFromEuler(euler);

			if (preRotation !== undefined) quaternion.premultiply(preRotation);
			if (postRotation !== undefined) quaternion.multiply(postRotation);

			quaternion.toArray(quaternionValues, (i / 3) * 4);
		}

		return new QuaternionKeyframeTrack(modelName + '.quaternion', times, quaternionValues);
	}

	generateMorphTrack(rawTracks) {
		const sceneGraph = getSceneGraph();
		const curves = rawTracks.DeformPercent.curves.morph;
		const values = curves.values.map(function (val) {
			return val / 100;
		});

		const morphNum = sceneGraph.getObjectByName(rawTracks.modelName).morphTargetDictionary[rawTracks.morphName];

		return new NumberKeyframeTrack(rawTracks.modelName + '.morphTargetInfluences[' + morphNum + ']', curves.times, values);
	}

	// For all animated objects, times are defined separately for each axis
	// Here we'll combine the times into one sorted array without duplicates
	getTimesForAllAxes(curves) {
		let times = [];

		// first join together the times for each axis, if defined
		if (curves.x !== undefined) times = times.concat(curves.x.times);
		if (curves.y !== undefined) times = times.concat(curves.y.times);
		if (curves.z !== undefined) times = times.concat(curves.z.times);

		// then sort them
		times = times.sort(function (a, b) {
			return a - b;
		});

		// and remove duplicates
		if (times.length > 1) {
			let targetIndex = 1;
			let lastValue = times[0];
			for (let i = 1; i < times.length; i++) {
				const currentValue = times[i];
				if (currentValue !== lastValue) {
					times[targetIndex] = currentValue;
					lastValue = currentValue;
					targetIndex++;
				}
			}

			times = times.slice(0, targetIndex);
		}

		return times;
	}

	getKeyframeTrackValues(times, curves, initialValue) {
		const prevValue = initialValue;

		const values = [];

		let xIndex = -1;
		let yIndex = -1;
		let zIndex = -1;

		times.forEach(function (time) {
			if (curves.x) xIndex = curves.x.times.indexOf(time);
			if (curves.y) yIndex = curves.y.times.indexOf(time);
			if (curves.z) zIndex = curves.z.times.indexOf(time);

			// if there is an x value defined for this frame, use that
			if (xIndex !== -1) {
				const xValue = curves.x.values[xIndex];
				values.push(xValue);
				prevValue[0] = xValue;
			} else {
				// otherwise use the x value from the previous frame
				values.push(prevValue[0]);
			}

			if (yIndex !== -1) {
				const yValue = curves.y.values[yIndex];
				values.push(yValue);
				prevValue[1] = yValue;
			} else {
				values.push(prevValue[1]);
			}

			if (zIndex !== -1) {
				const zValue = curves.z.values[zIndex];
				values.push(zValue);
				prevValue[2] = zValue;
			} else {
				values.push(prevValue[2]);
			}
		});

		return values;
	}

	// Rotations are defined as Euler angles which can have values  of any size
	// These will be converted to quaternions which don't support values greater than
	// PI, so we'll interpolate large rotations
	interpolateRotations(curve) {
		for (let i = 1; i < curve.values.length; i++) {
			const initialValue = curve.values[i - 1];
			const valuesSpan = curve.values[i] - initialValue;

			const absoluteSpan = Math.abs(valuesSpan);

			if (absoluteSpan >= 180) {
				const numSubIntervals = absoluteSpan / 180;

				const step = valuesSpan / numSubIntervals;
				let nextValue = initialValue + step;

				const initialTime = curve.times[i - 1];
				const timeSpan = curve.times[i] - initialTime;
				const interval = timeSpan / numSubIntervals;
				let nextTime = initialTime + interval;

				const interpolatedTimes = [];
				const interpolatedValues = [];

				while (nextTime < curve.times[i]) {
					interpolatedTimes.push(nextTime);
					nextTime += interval;

					interpolatedValues.push(nextValue);
					nextValue += step;
				}

				curve.times = inject(curve.times, i, interpolatedTimes);
				curve.values = inject(curve.values, i, interpolatedValues);
			}
		}
	}
}
