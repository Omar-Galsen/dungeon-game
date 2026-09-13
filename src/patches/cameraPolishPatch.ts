import Phaser from "phaser";
import HuntScene from "../scenes/HuntScene";
import DungeonScene from "../scenes/DungeonScene";
import VillageScene from "../scenes/VillageScene";

type SceneWithPlayer = Phaser.Scene & { player?: Phaser.Physics.Arcade.Sprite };
type SceneCtor = { prototype: SceneWithPlayer & { create: (...args: any[]) => void } };

function polishSceneCamera(
  SceneClass: SceneCtor,
  baseZoom: number,
  shadowYOffset: number,
  huntQuality = false,
) {
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
      // Cinematic third-person-inspired framing for a 2D game:
      // keep the hero near the center, slightly lower in the frame, with a soft
      // forward bias and springy camera response instead of a rigid lock-on.
      const focus = scene.add.zone(player.x, player.y, 1, 1).setVisible(false);
      camera.startFollow(focus, true, huntQuality ? 0.055 : 0.065, huntQuality ? 0.055 : 0.065);
      camera.setFollowOffset(0, 34);
      camera.setDeadzone(huntQuality ? 34 : 28, huntQuality ? 24 : 20);

      const shadow = scene.add.ellipse(
        player.x,
        player.y + shadowYOffset,
        64,
        22,
        0x000000,
        0.22,
      );
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
          const nx = vx / speed;
          const ny = vy / speed;
          lookX = Phaser.Math.Linear(lookX, nx, 0.075);
          lookY = Phaser.Math.Linear(lookY, ny, 0.075);
        }

        // Modest look-ahead: enough to see where you are going while preserving
        // the player as the visual anchor of the shot.
        const lead = moving ? (huntQuality ? 62 : 58) : 26;
        const targetX = player.x + lookX * lead;
        const targetY = player.y + lookY * lead;

        const followEase = moving ? 0.085 : 0.06;
        focusX = Phaser.Math.Linear(focusX, targetX, followEase);
        focusY = Phaser.Math.Linear(focusY, targetY, followEase);
        focus.setPosition(focusX, focusY);

        // A tiny breathing/sway motion makes traversal feel less like a flat editor camera.
        sway += delta * 0.0022;
        const swayAmount = moving ? 2.2 : 0.8;
        camera.setFollowOffset(Math.sin(sway) * swayAmount, 34 + Math.cos(sway * 0.7) * 1.5);

        shadow.setPosition(player.x, player.y + shadowYOffset);
        shadow.setScale(moving ? 0.94 : 1, moving ? 0.88 : 1);

        // Keep the Hunting map close even while moving; only a tiny pull-back is used.
        const targetZoom = moving ? baseZoom - (huntQuality ? 0.018 : 0.028) : baseZoom;
        currentZoom = Phaser.Math.Linear(currentZoom, targetZoom, moving ? 0.035 : 0.022);
        camera.setZoom(currentZoom);
      });

      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        focus.destroy();
        shadow.destroy();
      });
    }

    // Subtle cinematic edge shading while keeping the map readable.
    const vignette = scene.add.graphics().setScrollFactor(0).setDepth(9998);
    const w = scene.scale.width;
    const h = scene.scale.height;
    vignette.fillStyle(0x000000, huntQuality ? 0.055 : 0.085);
    vignette.fillRect(0, 0, w, 18);
    vignette.fillRect(0, h - 18, w, 18);
    vignette.fillRect(0, 0, 18, h);
    vignette.fillRect(w - 18, 0, 18, h);
  };
}

export function installCameraPolishPatch() {
  // Hunting is intentionally closer so the character and nearby paths dominate the view.
  polishSceneCamera(HuntScene as unknown as SceneCtor, 1.12, 42, true);
  polishSceneCamera(DungeonScene as unknown as SceneCtor, 0.90, 46);
  polishSceneCamera(VillageScene as unknown as SceneCtor, 0.87, 46);
}
