/**
 * Data manipulation utilities
 */

import { FBX_TIMECODE_TO_SECONDS } from './constants.js';

const dataArray = [];

export function append(a, b) {
	for (let i = 0, j = a.length, l = b.length; i < l; i++, j++) {
		a[j] = b[i];
	}
}

export function slice(a, b, from, to) {
	for (let i = from, j = 0; i < to; i++, j++) {
		a[j] = b[i];
	}
	return a;
}

export function inject(a1, index, a2) {
	return a1.slice(0, index).concat(a2).concat(a1.slice(index));
}

export function parseNumberArray(value) {
	const array = value.split(',').map(function (val) {
		return parseFloat(val);
	});
	return array;
}

export function convertFBXTimeToSeconds(time) {
	return time / FBX_TIMECODE_TO_SECONDS;
}

export function getData(polygonVertexIndex, polygonIndex, vertexIndex, infoObject) {
	let index;

	switch (infoObject.mappingType) {
		case 'ByPolygonVertex':
			index = polygonVertexIndex;
			break;
		case 'ByPolygon':
			index = polygonIndex;
			break;
		case 'ByVertice':
			index = vertexIndex;
			break;
		case 'AllSame':
			index = infoObject.indices[0];
			break;
		default:
			console.warn('THREE.FBXLoader: unknown attribute mapping type ' + infoObject.mappingType);
	}

	if (infoObject.referenceType === 'IndexToDirect') index = infoObject.indices[index];

	const from = index * infoObject.dataSize;
	const to = from + infoObject.dataSize;

	return slice(dataArray, infoObject.buffer, from, to);
}
