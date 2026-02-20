/**
 * Type checking and format detection utilities
 */

import { FBX_BINARY_SIGNATURE, FBX_ASCII_SIGNATURE } from './constants.js';

export function convertArrayBufferToString(buffer, from, to) {
	if (from === undefined) from = 0;
	if (to === undefined) to = buffer.byteLength;

	return new TextDecoder().decode(new Uint8Array(buffer, from, to));
}

export function isFbxFormatBinary(buffer) {
	return buffer.byteLength >= FBX_BINARY_SIGNATURE.length && 
		FBX_BINARY_SIGNATURE === convertArrayBufferToString(buffer, 0, FBX_BINARY_SIGNATURE.length);
}

export function isFbxFormatASCII(text) {
	let cursor = 0;

	function read(offset) {
		const result = text[offset - 1];
		text = text.slice(cursor + offset);
		cursor++;
		return result;
	}

	for (let i = 0; i < FBX_ASCII_SIGNATURE.length; ++i) {
		const num = read(1);
		if (num === FBX_ASCII_SIGNATURE[i]) {
			return false;
		}
	}

	return true;
}

export function getFbxVersion(text) {
	const versionRegExp = /FBXVersion: (\d+)/;
	const match = text.match(versionRegExp);

	if (match) {
		const version = parseInt(match[1]);
		return version;
	}

	throw new Error('THREE.FBXLoader: Cannot find the version number for the file given.');
}
