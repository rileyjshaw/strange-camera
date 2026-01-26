import bigFace from './big-face';
import bodyCamo from './body-camo';
import channels from './channels';
import cutGlass from './cut-glass';
import cutup from './cutup';
import faceCamo from './face-camo';
import fishbowl from './fishbowl';
import lightTrails from './light-trails';
import pixelface from './pixelface';
import salon from './salon';
import sunday from './sunday';
import wiggleX from './wiggle x';
import wiggleY from './wiggle y';
import wireface from './wireface';

const scenes = [
	bigFace,
	bodyCamo,
	channels,
	cutGlass,
	cutup,
	faceCamo,
	fishbowl,
	lightTrails,
	pixelface,
	salon,
	sunday,
	wiggleX,
	wiggleY,
	wireface,
].sort((a, b) => a.name.localeCompare(b.name));

export const sceneHashToIndex = new Map(scenes.map((scene, index) => [scene.hash, index]));

export default scenes;
