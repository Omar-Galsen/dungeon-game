import Phaser from "phaser";
import HuntScene from "../scenes/HuntScene";
import DungeonScene from "../scenes/DungeonScene";
import VillageScene from "../scenes/VillageScene";

type SceneWithPlayer = Phaser.Scene & { player?: Phaser.Physics.Arcade.Sprite };

type SceneCtor = { prototype: SceneWithPlayer & { create: (...args: any[]) => void } };

function polishSceneCamera(SceneClass: SceneCtor, zoom: number, shadowYOffset: number) {
  const proto = SceneClass.prototype;
  const originalCreate = proto.create;

  proto.create = function (...args: any[]) {
    originalCreate.apply(this, args);

    const scene = this as SceneWithPlayer;
    const camera = scene.cameras.main;
    const player = scene.player;

    camera.setZoom(zoom);
    camera.setRoundPixels(true);

    if (player) {
      camera.startFollow(player, true, 0.075, 0.075);
      camera.setFollowOffset(0, -20);

      const shadow = scene.add.ellipse(
        player.x,
        player.y + shadowYOffset,
        64,
        22,
        0x000000,
        0.28,
      );
      shadow.setDepth(Math.max(0, player.depth - 1));

      scene.events.on(Phaser.Scenes.Events.UPDATE, () => {
        if (!player.active || !shadow.active) return;
        shadow.setPosition(player.x, player.y + shadowYOffset);
        const moving = Math.abs(player.body?.velocity.x ?? 0) + Math.abs(player.body?.velocity.y ?? 0) > 5;
        shadow.setScale(moving ? 0.92 : 1, moving ? 0.86 : 1);
      });

      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => shadow.destroy());
    }

    const vignette = scene.add.graphics();
    vignette.setScrollFactor(0).setDepth(9998);
    const w = scene.scale.width;
    const h = scene.scale.height;
    vignette.fillStyle(0x000000, 0.16);
    vignette.fillRect(0, 0, w, 28);
    vignette.fillRect(0, h - 28, w, 28);
    vignette.fillRect(0, 0, 28, h);
    vignette.fillRect(w - 28, 0, 28, h);
  };
}

export function installCameraPolishPatch() {
  polishSceneCamera(HuntScene as unknown as SceneCtor, 0.82, 42);
  polishSceneCamera(DungeonScene as unknown as SceneCtor, 0.84, 46);
  polishSceneCamera(VillageScene as unknown as SceneCtor, 0.78, 46);
}
