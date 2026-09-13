import Phaser from "phaser";
import HuntScene from "../scenes/HuntScene";

type HuntSceneAny = HuntScene & Record<string, any>;

type MinimapSlimeMarker = {
  id: number;
  dot: Phaser.GameObjects.Arc;
};

const WORLD_SIZE = 3000;
const MAP_SIZE = 220;
const MAP_X = 752;
const MAP_Y = 18;
const MAP_INSET = 8;
const INNER_SIZE = MAP_SIZE - MAP_INSET * 2;
const CAVE_X = 1715;
const CAVE_Y = 400;

function worldToMini(value: number) {
  return MAP_INSET + Phaser.Math.Clamp(value / WORLD_SIZE, 0, 1) * INNER_SIZE;
}

export function installHuntMinimapPatch() {
  const proto = HuntScene.prototype as unknown as Record<string, any>;

  proto.createHuntMinimap = function (this: HuntSceneAny) {
    const container = this.add.container(MAP_X, MAP_Y);
    container.setScrollFactor(0);
    container.setDepth(900);

    const shadow = this.add.rectangle(4, 4, MAP_SIZE + 8, MAP_SIZE + 38, 0x000000, 0.45);
    shadow.setOrigin(0, 0);

    const panel = this.add.rectangle(0, 0, MAP_SIZE + 8, MAP_SIZE + 38, 0x111827, 0.92);
    panel.setOrigin(0, 0);
    panel.setStrokeStyle(2, 0xc9a227, 0.95);

    const title = this.add.text(10, 7, "HUNT MAP", {
      fontFamily: "Georgia",
      fontSize: "16px",
      fontStyle: "bold",
      color: "#f5d76e",
      stroke: "#000000",
      strokeThickness: 3,
    });

    const mapImage = this.add.image(MAP_INSET, 30, "huntingMap");
    mapImage.setOrigin(0, 0);
    mapImage.setDisplaySize(INNER_SIZE, INNER_SIZE);
    mapImage.setAlpha(0.82);

    const mapShade = this.add.rectangle(MAP_INSET, 30, INNER_SIZE, INNER_SIZE, 0x08111f, 0.18);
    mapShade.setOrigin(0, 0);
    mapShade.setStrokeStyle(2, 0xffffff, 0.65);

    const playerDot = this.add.circle(0, 0, 6, 0x38bdf8, 1);
    playerDot.setStrokeStyle(2, 0xffffff, 1);

    const slimeMarkers: MinimapSlimeMarker[] = [];
    for (const slime of this.slimes ?? []) {
      const dot = this.add.circle(0, 0, 5, 0xef4444, 1);
      dot.setStrokeStyle(1, 0xffffff, 0.9);
      slimeMarkers.push({ id: slime.id, dot });
    }

    const caveMarker = this.add.circle(
      worldToMini(CAVE_X),
      30 + worldToMini(CAVE_Y),
      6,
      0xfacc15,
      1
    );
    caveMarker.setStrokeStyle(2, 0x111827, 1);

    const caveLabel = this.add.text(
      worldToMini(CAVE_X) + 9,
      30 + worldToMini(CAVE_Y) - 7,
      "SHOP",
      {
        fontFamily: "Arial",
        fontSize: "10px",
        fontStyle: "bold",
        color: "#fde68a",
        stroke: "#000000",
        strokeThickness: 3,
      }
    );

    const dungeonX = typeof this.DUNGEON_X === "number" ? this.DUNGEON_X : 2780;
    const dungeonY = typeof this.DUNGEON_Y === "number" ? this.DUNGEON_Y : 1150;

    const dungeonMarker = this.add.circle(
      worldToMini(dungeonX),
      30 + worldToMini(dungeonY),
      7,
      0xa855f7,
      1
    );
    dungeonMarker.setStrokeStyle(2, 0xffffff, 1);
    dungeonMarker.setVisible(false);

    const dungeonLabel = this.add.text(
      worldToMini(dungeonX) - 8,
      30 + worldToMini(dungeonY) + 9,
      "DUNGEON",
      {
        fontFamily: "Arial",
        fontSize: "9px",
        fontStyle: "bold",
        color: "#e9d5ff",
        stroke: "#000000",
        strokeThickness: 3,
      }
    );
    dungeonLabel.setOrigin(1, 0);
    dungeonLabel.setVisible(false);

    const youLegend = this.add.circle(118, 14, 4, 0x38bdf8, 1);
    const youText = this.add.text(126, 7, "YOU", {
      fontFamily: "Arial",
      fontSize: "10px",
      fontStyle: "bold",
      color: "#ffffff",
    });

    const slimeLegend = this.add.circle(158, 14, 4, 0xef4444, 1);
    const slimeText = this.add.text(166, 7, "SLIME", {
      fontFamily: "Arial",
      fontSize: "10px",
      fontStyle: "bold",
      color: "#ffffff",
    });

    const shopLegend = this.add.circle(207, 14, 4, 0xfacc15, 1);

    container.add([
      shadow,
      panel,
      title,
      mapImage,
      mapShade,
      caveMarker,
      caveLabel,
      dungeonMarker,
      dungeonLabel,
      playerDot,
      ...slimeMarkers.map((marker) => marker.dot),
      youLegend,
      youText,
      slimeLegend,
      slimeText,
      shopLegend,
    ]);

    this.huntMinimap = container;
    this.huntMinimapPlayerDot = playerDot;
    this.huntMinimapSlimeMarkers = slimeMarkers;
    this.huntMinimapCaveMarker = caveMarker;
    this.huntMinimapDungeonMarker = dungeonMarker;
    this.huntMinimapDungeonLabel = dungeonLabel;

    this.tweens.add({
      targets: dungeonMarker,
      scale: 1.45,
      alpha: 0.55,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.updateHuntMinimap();
  };

  proto.updateHuntMinimap = function (this: HuntSceneAny) {
    if (!this.huntMinimap || !this.huntMinimapPlayerDot || !this.player) return;

    this.huntMinimapPlayerDot.setPosition(
      worldToMini(this.player.x),
      30 + worldToMini(this.player.y)
    );

    const markerMap = new Map<number, Phaser.GameObjects.Arc>();
    for (const marker of (this.huntMinimapSlimeMarkers ?? []) as MinimapSlimeMarker[]) {
      markerMap.set(marker.id, marker.dot);
      marker.dot.setVisible(false);
    }

    for (const slime of this.slimes ?? []) {
      const dot = markerMap.get(slime.id);
      if (!dot) continue;

      const visible = slime.alive && slime.sprite?.active;
      dot.setVisible(visible);
      if (!visible) continue;

      dot.setPosition(
        worldToMini(slime.sprite.x),
        30 + worldToMini(slime.sprite.y)
      );
    }

    const remaining = (this.slimes ?? []).filter((slime: any) => slime.alive).length;
    const huntCleared = remaining === 0 || this.registry.get("huntCleared") === true;

    if (this.huntMinimapDungeonMarker) {
      this.huntMinimapDungeonMarker.setVisible(huntCleared);
    }
    if (this.huntMinimapDungeonLabel) {
      this.huntMinimapDungeonLabel.setVisible(huntCleared);
    }
  };

  const originalCreate = proto.create;
  proto.create = function (this: HuntSceneAny) {
    originalCreate.call(this);
    this.createHuntMinimap();
  };

  const originalUpdate = proto.update;
  proto.update = function (this: HuntSceneAny, time: number, delta: number) {
    originalUpdate.call(this, time, delta);
    this.updateHuntMinimap();
  };
}
