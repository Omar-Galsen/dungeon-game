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
      // Keep the player as the visual center of the world. The camera follows with a
      // soft delay rather than looking ahead, giving the feeling of walking through
      // the woods while the environment moves naturally around the character.
      camera.startFollow(
        player,
        true,
        huntQuality ? 0.065 : 0.075,
        huntQuality ? 0.065 : 0.075,
      );
      camera.setFollowOffset(0, 0);
      camera.setDeadzone(0, 0);

      const shadow = scene.add.ellipse(
        player.x,
        player.y + shadowYOffset,
        64,
        22,
        0x000000,
        0.22,
      );
      shadow.setDepth(Math.max(0, player.depth - 1));

      let currentZoom = baseZoom;

      scene.events.on(Phaser.Scenes.Events.UPDATE, () => {
        if (!player.active || !shadow.active) return;

        const vx = player.body?.velocity.x ?? 0;
        const vy = player.body?.velocity.y ?? 0;
        const speed = Math.hypot(vx, vy);
        const moving = speed > 5;

        shadow.setPosition(player.x, player.y + shadowYOffset);
        shadow.setScale(moving ? 0.94 : 1, moving ? 0.88 : 1);

        // Very small cinematic pull-back while walking. It keeps the player centered,
        // but reveals a little more forest around them without making the map feel tiny.
        const targetZoom = moving ? baseZoom - 0.018 : baseZoom;
        currentZoom = Phaser.Math.Linear(currentZoom, targetZoom, 0.025);
        camera.setZoom(currentZoom);
      });

      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        shadow.destroy();
      });
    }

    // Light edge shading adds depth without covering the artwork.
    const vignette = scene.add.graphics().setScrollFactor(0).setDepth(9998);
    const w = scene.scale.width;
    const h = scene.scale.height;
    vignette.fillStyle(0x000000, huntQuality ? 0.045 : 0.075);
    vignette.fillRect(0, 0, w, 14);
    vignette.fillRect(0, h - 14, w, 14);
    vignette.fillRect(0, 0, 14, h);
    vignette.fillRect(w - 14, 0, 14, h);
  };
}

export function installCameraPolishPatch() {
  // The player remains centered while the camera gently trails their walk.
  polishSceneCamera(HuntScene as unknown as SceneCtor, 0.90, 42, true);
  polishSceneCamera(DungeonScene as unknown as SceneCtor, 0.86, 46);
  polishSceneCamera(VillageScene as unknown as SceneCtor, 0.82, 46);
}
