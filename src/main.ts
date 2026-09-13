import Phaser from "phaser";

import MainMenuScene from "./scenes/MainMenuScene";
import GameScene from "./scenes/GameScene";
import HuntScene from "./scenes/HuntScene";
import DungeonScene from "./scenes/DungeonScene";
import VillageScene from "./scenes/VillageScene";
import HuntingCollisionEditor from "./scenes/HuntingCollisionEditor";
import { installHuntAttackPatch } from "./patches/huntAttackPatch";
import { installHuntMinimapPatch } from "./patches/huntMinimapPatch";
import { installSwordProgressionPatch } from "./patches/swordProgressionPatch";
import { installHuntSlimePlacementPatch } from "./patches/huntSlimePlacementPatch";

installHuntAttackPatch();
installHuntMinimapPatch();
installSwordProgressionPatch();
installHuntSlimePlacementPatch();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1000,
  height: 700,
  backgroundColor: "#090b10",
  parent: "game",
  physics: { default: "arcade", arcade: { debug: false, gravity: { x: 0, y: 0 } } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [MainMenuScene, GameScene, HuntScene, DungeonScene, VillageScene, HuntingCollisionEditor],
};

new Phaser.Game(config);
