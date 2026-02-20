/**
 * Transform calculation utilities
 */

import { Euler, Matrix4, Vector3, MathUtils } from 'three';
import { EULER_ORDER_MAP, SPHERICAL_EULER_ORDER } from './constants.js';

const tempEuler = new Euler();
const tempVec = new Vector3();

export function getEulerOrder(order) {
	order = order || 0;

	if (order === SPHERICAL_EULER_ORDER) {
		console.warn('THREE.FBXLoader: unsupported Euler Order: Spherical XYZ. Animations and rotations may be incorrect.');
		return EULER_ORDER_MAP[0];
	}

	return EULER_ORDER_MAP[order];
}

export function generateTransform(transformData) {
	const lTranslationM = new Matrix4();
	const lPreRotationM = new Matrix4();
	const lRotationM = new Matrix4();
	const lPostRotationM = new Matrix4();

	const lScalingM = new Matrix4();
	const lScalingPivotM = new Matrix4();
	const lScalingOffsetM = new Matrix4();
	const lRotationOffsetM = new Matrix4();
	const lRotationPivotM = new Matrix4();

	const lParentGX = new Matrix4();
	const lParentLX = new Matrix4();
	const lGlobalT = new Matrix4();

	const inheritType = (transformData.inheritType) ? transformData.inheritType : 0;

	if (transformData.translation) lTranslationM.setPosition(tempVec.fromArray(transformData.translation));

	if (transformData.preRotation) {
		const array = transformData.preRotation.map(MathUtils.degToRad);
		array.push(transformData.eulerOrder || Euler.DEFAULT_ORDER);
		lPreRotationM.makeRotationFromEuler(tempEuler.fromArray(array));
	}

	if (transformData.rotation) {
		const array = transformData.rotation.map(MathUtils.degToRad);
		array.push(transformData.eulerOrder || Euler.DEFAULT_ORDER);
		lRotationM.makeRotationFromEuler(tempEuler.fromArray(array));
	}

	if (transformData.postRotation) {
		const array = transformData.postRotation.map(MathUtils.degToRad);
		array.push(transformData.eulerOrder || Euler.DEFAULT_ORDER);
		lPostRotationM.makeRotationFromEuler(tempEuler.fromArray(array));
		lPostRotationM.invert();
	}

	if (transformData.scale) lScalingM.scale(tempVec.fromArray(transformData.scale));

	// Pivots and offsets
	if (transformData.scalingOffset) lScalingOffsetM.setPosition(tempVec.fromArray(transformData.scalingOffset));
	if (transformData.scalingPivot) lScalingPivotM.setPosition(tempVec.fromArray(transformData.scalingPivot));
	if (transformData.rotationOffset) lRotationOffsetM.setPosition(tempVec.fromArray(transformData.rotationOffset));
	if (transformData.rotationPivot) lRotationPivotM.setPosition(tempVec.fromArray(transformData.rotationPivot));

	// parent transform
	if (transformData.parentMatrixWorld) {
		lParentLX.copy(transformData.parentMatrix);
		lParentGX.copy(transformData.parentMatrixWorld);
	}

	const lLRM = lPreRotationM.clone().multiply(lRotationM).multiply(lPostRotationM);
	// Global Rotation
	const lParentGRM = new Matrix4();
	lParentGRM.extractRotation(lParentGX);

	// Global Shear*Scaling
	const lParentTM = new Matrix4();
	lParentTM.copyPosition(lParentGX);

	const lParentGRSM = lParentTM.clone().invert().multiply(lParentGX);
	const lParentGSM = lParentGRM.clone().invert().multiply(lParentGRSM);
	const lLSM = lScalingM;

	const lGlobalRS = new Matrix4();

	if (inheritType === 0) {
		lGlobalRS.copy(lParentGRM).multiply(lLRM).multiply(lParentGSM).multiply(lLSM);
	} else if (inheritType === 1) {
		lGlobalRS.copy(lParentGRM).multiply(lParentGSM).multiply(lLRM).multiply(lLSM);
	} else {
		const lParentLSM = new Matrix4().scale(new Vector3().setFromMatrixScale(lParentLX));
		const lParentLSM_inv = lParentLSM.clone().invert();
		const lParentGSM_noLocal = lParentGSM.clone().multiply(lParentLSM_inv);

		lGlobalRS.copy(lParentGRM).multiply(lLRM).multiply(lParentGSM_noLocal).multiply(lLSM);
	}

	const lRotationPivotM_inv = lRotationPivotM.clone().invert();
	const lScalingPivotM_inv = lScalingPivotM.clone().invert();
	
	// Calculate the local transform matrix
	let lTransform = lTranslationM.clone()
		.multiply(lRotationOffsetM)
		.multiply(lRotationPivotM)
		.multiply(lPreRotationM)
		.multiply(lRotationM)
		.multiply(lPostRotationM)
		.multiply(lRotationPivotM_inv)
		.multiply(lScalingOffsetM)
		.multiply(lScalingPivotM)
		.multiply(lScalingM)
		.multiply(lScalingPivotM_inv);

	const lLocalTWithAllPivotAndOffsetInfo = new Matrix4().copyPosition(lTransform);

	const lGlobalTranslation = lParentGX.clone().multiply(lLocalTWithAllPivotAndOffsetInfo);
	lGlobalT.copyPosition(lGlobalTranslation);

	lTransform = lGlobalT.clone().multiply(lGlobalRS);

	// from global to local
	lTransform.premultiply(lParentGX.invert());

	return lTransform;
}
