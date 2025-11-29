import channels from './channels';
import cutup from './cutup';
import faceCamo from './face-camo';
import wiggleX from './wiggle x';
import wiggleY from './wiggle y';

const scenes = [channels, cutup, faceCamo, wiggleX, wiggleY].sort((a, b) => a.name.localeCompare(b.name));

export default scenes;
