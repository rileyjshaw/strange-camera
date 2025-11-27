import cutup from './cutup';
import wiggleX from './wiggle x';
import wiggleY from './wiggle y';

const scenes = [cutup, wiggleX, wiggleY].sort((a, b) => a.name.localeCompare(b.name));

export default scenes;
