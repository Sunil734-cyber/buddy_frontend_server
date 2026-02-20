/**
 * FBXLoader - Main loader class for FBX files
 * Loads FBX file and generates Group representing FBX scene.
 * Requires FBX file to be >= 7.0 and in ASCII or >= 6400 in Binary format
 */

import {
	Loader,
	FileLoader,
	LoaderUtils,
	TextureLoader
} from 'three';
import { BinaryParser } from './parsers/BinaryParser.js';
import { TextParser } from './parsers/TextParser.js';
import { FBXTreeParser } from './tree/FBXTreeParser.js';
import { setFbxTree, resetContext } from './shared/context.js';
import { isFbxFormatBinary, isFbxFormatASCII, getFbxVersion, convertArrayBufferToString } from './utils/typeUtils.js';

export class FBXLoader extends Loader {
	constructor(manager) {
		super(manager);
	}

	load(url, onLoad, onProgress, onError) {
		const scope = this;

		const path = (scope.path === '') ? LoaderUtils.extractUrlBase(url) : scope.path;

		const loader = new FileLoader(this.manager);
		loader.setPath(scope.path);
		loader.setResponseType('arraybuffer');
		loader.setRequestHeader(scope.requestHeader);
		loader.setWithCredentials(scope.withCredentials);

		loader.load(url, function (buffer) {
			try {
				onLoad(scope.parse(buffer, path));
			} catch (e) {
				if (onError) {
					onError(e);
				} else {
					console.error(e);
				}

				scope.manager.itemError(url);
			}
		}, onProgress, onError);
	}

	parse(FBXBuffer, path) {
		// Reset context for each parse
		resetContext();

		let fbxTree;

		if (isFbxFormatBinary(FBXBuffer)) {
			fbxTree = new BinaryParser().parse(FBXBuffer);
		} else {
			const FBXText = convertArrayBufferToString(FBXBuffer);

			if (!isFbxFormatASCII(FBXText)) {
				throw new Error('THREE.FBXLoader: Unknown format.');
			}

			if (getFbxVersion(FBXText) < 7000) {
				throw new Error('THREE.FBXLoader: FBX version not supported, FileVersion: ' + getFbxVersion(FBXText));
			}

			fbxTree = new TextParser().parse(FBXText);
		}

		// Store fbxTree in context
		setFbxTree(fbxTree);

		const textureLoader = new TextureLoader(this.manager).setPath(this.resourcePath || path).setCrossOrigin(this.crossOrigin);

		return new FBXTreeParser(textureLoader, this.manager).parse();
	}
}
