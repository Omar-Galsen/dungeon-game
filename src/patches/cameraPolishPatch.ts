import Phaser from "phaser";
import HuntScene from "../scenes/HuntScene";
import DungeonScene from "../scenes/DungeonScene";
import VillageScene from "../scenes/VillageScene";

type SceneWithPlayer = Phaser.Scene & { player?: Phaser.Physics.Arcade.Sprite };
type SceneCtor = { prototype: SceneWithPlayer & { create: (...args: any[]) => void } };

function polishSceneCamera(SceneClass: SceneCtor, zoom: number, shadowYOffset: number, huntQuality = false) {
  const proto = SceneClass.prototype;
  const originalCreate = proto.create;

  proto.create = function (...args: any[]) {
    originalCreate.apply(this, args);
    const scene = this as SceneWithPlayer;
    const camera = scene.cameras.main;
    const player = scene.player;

    camera.setZoom(zoom);
    // Fractional zoom + roundPixels can make a high-resolution map shimmer while moving.
    camera.setRoundPixels(!huntQuality);

    if (player) {
      camera.startFollow(player, true, huntQuality ? 0.12 : 0.075, huntQuality ? 0.12 : 0.075);
      camera.setFollowOffset(0, huntQuality ? -28 : -20);
      if (huntQuality) camera.setDeadzone(110, 80);

      const shadow = scene.add.ellipse(player.x, player.y + shadowYOffset, 64, 22, 0x000000, 0.24);
      shadow.setDepth(Math.max(0, player.depth - 1));
      scene.events.on(Phaser.Scenes.Events.UPDATE, () => {
        if (!player.active || !shadow.active) return;
        shadow.setPosition(player.x, player.y + shadowYOffset);
        const moving = Math.abs(player.body?.velocity.x ?? 0) + Math.abs(player.body?.velocity.y ?? 0) > 5;
        shadow.setScale(moving ? 0.94 : 1, moving ? 0.88 : 1);
      });
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => shadow.destroy());
    }

    // Keep the frame subtle so the artwork stays bright and readable.
    const vignette = scene.add.graphics().setScrollFactor(0).setDepth(9998);
    const w = scene.scale.width, h = scene.scale.height;
    vignette.fillStyle(0x000000, huntQuality ? 0.07 : 0.12);
    vignette.fillRect(0, 0, w, 18); vignette.fillRect(0, h - 18, w, 18);
    vignette.fillRect(0, 0, 18, h); vignette.fillRect(w - 18, 0, 18, h);
  };
}

export function installCameraPolishPatch() {
  // Hunting uses a slightly closer, smoother high-resolution camera.
  polishSceneCamera(HuntScene as unknown as SceneCtor, 0.88, 42, true);
  polishSceneCamera(DungeonScene as unknown as SceneCtor, 0.84, 46);
  polishSceneCamera(VillageScene as unknown as SceneCtor, 0.78, 46);
}
