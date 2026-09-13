import Phaser from "phaser";
import HuntScene from "../scenes/HuntScene";
import DungeonScene from "../scenes/DungeonScene";
import VillageScene from "../scenes/VillageScene";

type SceneWithPlayer = Phaser.Scene & { player?: Phaser.Physics.Arcade.Sprite };
type SceneCtor = { prototype: SceneWithPlayer & { create: (...args: any[]) => void } };

function polishSceneCamera(SceneClass: SceneCtor, baseZoom: number, shadowYOffset: number, huntQuality = false) {
  const proto = SceneClass.prototype;
  const originalCreate = proto.create;

  proto.create = function (...args: any[]) {
    originalCreate.apply(this, args);
    const scene = this as SceneWithPlayer;
    const camera = scene.cameras.main;
    const player = scene.player;

    camera.setZoom(baseZoom);
    camera.setRoundPixels(!huntQuality);

    if (player) {
      const focus = scene.add.zone(player.x, player.y, 1, 1).setVisible(false);
      camera.startFollow(focus, true, huntQuality ? 0.06 : 0.065, huntQuality ? 0.06 : 0.065);
      camera.setFollowOffset(0, 30);
      camera.setDeadzone(huntQuality ? 26 : 28, huntQuality ? 20 : 20);

      const shadow = scene.add.ellipse(player.x, player.y + shadowYOffset, 64, 22, 0x000000, 0.22);
      shadow.setDepth(Math.max(0, player.depth - 1));

      let lookX = 0;
      let lookY = -1;
      let focusX = player.x;
      let focusY = player.y;
      let currentZoom = baseZoom;
      let sway = 0;

      scene.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) => {
        if (!player.active || !focus.active || !shadow.active) return;
        const vx = player.body?.velocity.x ?? 0;
        const vy = player.body?.velocity.y ?? 0;
        const speed = Math.hypot(vx, vy);
        const moving = speed > 8;

        if (moving) {
          lookX = Phaser.Math.Linear(lookX, vx / speed, 0.075);
          lookY = Phaser.Math.Linear(lookY, vy / speed, 0.075);
        }

        const lead = moving ? (huntQuality ? 48 : 58) : 20;
        const targetX = player.x + lookX * lead;
        const targetY = player.y + lookY * lead;
        const followEase = moving ? 0.09 : 0.065;
        focusX = Phaser.Math.Linear(focusX, targetX, followEase);
        focusY = Phaser.Math.Linear(focusY, targetY, followEase);
        focus.setPosition(focusX, focusY);

        sway += delta * 0.002;
        const swayAmount = moving ? 1.7 : 0.6;
        camera.setFollowOffset(Math.sin(sway) * swayAmount, 30 + Math.cos(sway * 0.7));

        shadow.setPosition(player.x, player.y + shadowYOffset);
        shadow.setScale(moving ? 0.94 : 1, moving ? 0.88 : 1);

        const targetZoom = moving ? baseZoom - (huntQuality ? 0.012 : 0.028) : baseZoom;
        currentZoom = Phaser.Math.Linear(currentZoom, targetZoom, moving ? 0.04 : 0.025);
        camera.setZoom(currentZoom);
      });

      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        focus.destroy();
        shadow.destroy();
      });
    }

    const vignette = scene.add.graphics().setScrollFactor(0).setDepth(9998);
    const w = scene.scale.width;
    const h = scene.scale.height;
    vignette.fillStyle(0x000000, huntQuality ? 0.045 : 0.085);
    vignette.fillRect(0, 0, w, 14);
    vignette.fillRect(0, h - 14, w, 14);
    vignette.fillRect(0, 0, 14, h);
    vignette.fillRect(w - 14, 0, 14, h);
  };
}

export function installCameraPolishPatch() {
  // Hunting is much closer now so nearby paths, enemies and scenery fill the screen.
  polishSceneCamera(HuntScene as unknown as SceneCtor, 1.28, 42, true);
  polishSceneCamera(DungeonScene as unknown as SceneCtor, 0.90, 46);
  polishSceneCamera(VillageScene as unknown as SceneCtor, 0.87, 46);
}
