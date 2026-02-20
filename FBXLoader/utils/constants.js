/**
 * Constants used across FBX loader modules
 */

// FBX format signatures
export const FBX_BINARY_SIGNATURE = 'Kaydara\u0020FBX\u0020Binary\u0020\u0020\0';
export const FBX_ASCII_SIGNATURE = ['K', 'a', 'y', 'd', 'a', 'r', 'a', '\\', 'F', 'B', 'X', '\\', 'B', 'i', 'n', 'a', 'r', 'y', '\\', '\\'];

// FBX version
export const MIN_FBX_VERSION = 7000;
export const MIN_BINARY_VERSION = 6400;

// FBX ticks to seconds conversion
export const FBX_TIMECODE_TO_SECONDS = 46186158000;

// Euler order mapping (FBX extrinsic to Three.js intrinsic)
export const EULER_ORDER_MAP = [
	'ZYX', // -> XYZ extrinsic
	'YZX', // -> XZY extrinsic
	'XZY', // -> YZX extrinsic
	'ZXY', // -> YXZ extrinsic
	'YXZ', // -> ZXY extrinsic
	'XYZ', // -> ZYX extrinsic
];

export const SPHERICAL_EULER_ORDER = 6;
