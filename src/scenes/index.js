import bigFace from './big-face';
import blurryface from './blurryface';
import bodyCamo from './body-camo';
import bodyDouble from './body-double';
import channels from './channels';
import cutGlass from './cut-glass';
import cutup from './cutup';
import faceCamo from './face-camo';
import fill from './fill';
import fishbowl from './fishbowl';
import lightTrails from './light-trails';
import pixelface from './pixelface';
import salon from './salon';
import slow from './slow';
import sorted from './sorted';
import sunday from './sunday';
import wiggleX from './wiggle x';
import wiggleY from './wiggle y';
import wireface from './wireface';

const scenes = [
	bigFace,
	blurryface,
	bodyCamo,
	bodyDouble,
	channels,
	cutGlass,
	cutup,
	faceCamo,
	fill,
	fishbowl,
	lightTrails,
	pixelface,
	salon,
	slow,
	sorted,
	sunday,
	wiggleX,
	wiggleY,
	wireface,
].sort((a, b) => a.name.localeCompare(b.name));

export const sceneHashToIndex = new Map(scenes.map((scene, index) => [scene.hash, index]));

export default scenes;
