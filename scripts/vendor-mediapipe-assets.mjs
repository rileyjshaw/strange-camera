import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = dirname(require.resolve('@mediapipe/tasks-vision'));
const packageJsonPath = join(packageRoot, 'package.json');
const tasksVisionPackage = JSON.parse(await readFile(packageJsonPath, 'utf8'));

const modelCacheRoot = join(projectRoot, 'node_modules', '.cache', 'strange-camera', 'mediapipe-models');
const publicMediapipeRoot = join(projectRoot, 'public', 'mediapipe');
const publicTasksVisionRoot = join(
	publicMediapipeRoot,
	'tasks-vision',
	tasksVisionPackage.version
);

const models = [
	{
		constantName: 'FACE_MODEL_PATH',
		relativePath: 'face_landmarker/float16/face_landmarker.task',
		sha256: '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff',
		sourceUrl:
			'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
	},
	{
		constantName: 'POSE_MODEL_PATH',
		relativePath: 'pose_landmarker_lite/float16/pose_landmarker_lite.task',
		sha256: '59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a',
		sourceUrl:
			'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
	},
	{
		constantName: 'SELFIE_SEGMENTER_MODEL_PATH',
		relativePath: 'selfie_segmenter/float16/selfie_segmenter.tflite',
		sha256: '191ac9529ae506ee0beefa6b2c945a172dab9d07d1e802a290a4e4038226658b',
		sourceUrl:
			'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
	},
	{
		constantName: 'HAIR_SEGMENTER_MODEL_PATH',
		relativePath: 'hair_segmenter/float32/hair_segmenter.tflite',
		sha256: '2628cf3ce5f695f604cbea2841e00befcaa3624bf80caf3664bef2656d59bf84',
		sourceUrl:
			'https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/latest/hair_segmenter.tflite',
	},
	{
		constantName: 'SELFIE_MULTICLASS_SEGMENTER_MODEL_PATH',
		relativePath: 'selfie_multiclass_256x256/float32/selfie_multiclass_256x256.tflite',
		sha256: 'c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0',
		sourceUrl:
			'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite',
	},
];

async function copyDirectory(source, target) {
	await mkdir(target, { recursive: true });
	const entries = await readdir(source, { withFileTypes: true });
	await Promise.all(
		entries.map(async entry => {
			const sourcePath = join(source, entry.name);
			const targetPath = join(target, entry.name);
			if (entry.isDirectory()) {
				await copyDirectory(sourcePath, targetPath);
			} else if (entry.isFile()) {
				await mkdir(dirname(targetPath), { recursive: true });
				await copyFile(sourcePath, targetPath);
			}
		})
	);
}

async function sha256(filePath) {
	const hash = createHash('sha256');
	hash.update(await readFile(filePath));
	return hash.digest('hex');
}

async function downloadModel(model, targetPath) {
	if (typeof fetch !== 'function') {
		throw new Error('Model download requires Node.js 18 or newer.');
	}

	const response = await fetch(model.sourceUrl);
	if (!response.ok) {
		throw new Error(`Failed to download ${model.sourceUrl}: ${response.status} ${response.statusText}`);
	}

	const bytes = new Uint8Array(await response.arrayBuffer());
	await mkdir(dirname(targetPath), { recursive: true });
	await writeFile(targetPath, bytes);
}

async function resolveModel(model) {
	const cachePath = join(modelCacheRoot, model.sha256, model.relativePath);
	try {
		await stat(cachePath);
		if ((await sha256(cachePath)) === model.sha256) return cachePath;
	} catch {
		// Cache miss.
	}

	await downloadModel(model, cachePath);
	const actualHash = await sha256(cachePath);
	if (actualHash !== model.sha256) {
		await rm(cachePath, { force: true });
		throw new Error(
			`Unexpected checksum for ${model.relativePath}. Expected ${model.sha256}, got ${actualHash}.`
		);
	}
	return cachePath;
}

async function copyModel(model, sourcePath) {
	const targetPath = join(publicTasksVisionRoot, 'models', model.relativePath);
	await mkdir(dirname(targetPath), { recursive: true });
	await copyFile(sourcePath, targetPath);
}

async function writeTextIfChanged(filePath, contents) {
	try {
		if ((await readFile(filePath, 'utf8')) === contents) return;
	} catch {
		// File does not exist yet.
	}
	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, contents);
}

function generateMediapipeModule() {
	const version = tasksVisionPackage.version;
	const modelConstants = models
		.map(
			model =>
				`export const ${model.constantName} =\n\t'/mediapipe/tasks-vision/${version}/models/${model.relativePath}';`
		)
		.join('\n');

	return `// Generated by scripts/vendor-mediapipe-assets.mjs. Do not edit directly.\nexport const MEDIAPIPE_TASKS_VISION_VERSION = '${version}';\nexport const MEDIAPIPE_WASM_BASE_URL = '/mediapipe/tasks-vision/${version}/wasm';\n\n${modelConstants}\n`;
}

const wasmSourceRoot = join(packageRoot, 'wasm');
await stat(wasmSourceRoot);
const modelSourcePaths = await Promise.all(models.map(resolveModel));
await rm(publicMediapipeRoot, { recursive: true, force: true });
await copyDirectory(wasmSourceRoot, join(publicTasksVisionRoot, 'wasm'));
await Promise.all(models.map((model, index) => copyModel(model, modelSourcePaths[index])));
await writeTextIfChanged(
	join(projectRoot, 'src', 'scenes', 'mediapipe.js'),
	generateMediapipeModule()
);

console.log(`Vendored MediaPipe Tasks Vision ${tasksVisionPackage.version} assets.`);
