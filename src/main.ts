import Phaser from "phaser";

import GameScene from "./scenes/GameScene";
import HuntScene from "./scenes/HuntScene";
import DungeonScene from "./scenes/DungeonScene";
import HuntingCollisionEditor from "./scenes/HuntingCollisionEditor";
import { installHuntAttackPatch } from "./patches/huntAttackPatch";
import { installHuntMinimapPatch } from "./patches/huntMinimapPatch";

installHuntAttackPatch();
installHuntMinimapPatch();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,

  width: 1000,
  height: 700,

  backgroundColor: "#090b10",

  physics: {
    default: "arcade",
    arcade: {
      debug: false,
      gravity: {
        x: 0,
        y: 0,
      },
    },
  },

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },

  scene: [
    GameScene,
    HuntScene,
    DungeonScene,
    HuntingCollisionEditor,
  ],
};

new Phaser.Game(config);