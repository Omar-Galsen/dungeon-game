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

    const youLegend = this.add.circle(128, 14, 4, 0x38bdf8, 1);
    const youText = this.add.text(136, 7, "YOU", {
      fontFamily: "Arial",
      fontSize: "11px",
      fontStyle: "bold",
      color: "#ffffff",
    });
    const slimeLegend = this.add.circle(174, 14, 4, 0xef4444, 1);
    const slimeText = this.add.text(182, 7, "SLIME", {
      fontFamily: "Arial",
      fontSize: "11px",
      fontStyle: "bold",
      color: "#ffffff",
    });

    container.add([
      shadow,
      panel,
      title,
      mapImage,
      mapShade,
      playerDot,
      ...slimeMarkers.map((marker) => marker.dot),
      youLegend,
      youText,
      slimeLegend,
      slimeText,
    ]);

    this.huntMinimap = container;
    this.huntMinimapPlayerDot = playerDot;
    this.huntMinimapSlimeMarkers = slimeMarkers;

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
