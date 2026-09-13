import Phaser from "phaser";
import HuntScene from "../scenes/HuntScene";
import DungeonScene from "../scenes/DungeonScene";
import VillageScene from "../scenes/VillageScene";

type SceneWithPlayer = Phaser.Scene & { player?: Phaser.Physics.Arcade.Sprite };
type SceneCtor = { prototype: SceneWithPlayer & { create: (...args: any[]) => void } };

function polishSceneCamera(
  SceneClass: SceneCtor,
  zoom: number,
  shadowYOffset: number,
  lookAheadDistance: number,
  huntQuality = false,
) {
  const proto = SceneClass.prototype;
  const originalCreate = proto.create;

  proto.create = function (...args: any[]) {
    originalCreate.apply(this, args);

    const scene = this as SceneWithPlayer;
    const camera = scene.cameras.main;
    const player = scene.player;

    camera.setZoom(zoom);
    // Fractional zoom plus pixel rounding can make the large hunting map shimmer.
    camera.setRoundPixels(!huntQuality);

    if (player) {
      // Follow an invisible point in FRONT of the player instead of centering directly
      // on the sprite. This leaves the player slightly toward the rear of the frame and
      // gives the game a more forward-looking, over-the-shoulder feeling while staying 2D.
      const cameraFocus = scene.add.zone(player.x, player.y, 1, 1).setVisible(false);
      let lookX = 0;
      let lookY = -1;

      camera.startFollow(cameraFocus, true, huntQuality ? 0.10 : 0.085, huntQuality ? 0.10 : 0.085);
      camera.setFollowOffset(0, huntQuality ? -18 : -12);
      if (huntQuality) camera.setDeadzone(90, 64);

      const shadow = scene.add.ellipse(
        player.x,
        player.y + shadowYOffset,
        64,
        22,
        0x000000,
        0.24,
      );
      shadow.setDepth(Math.max(0, player.depth - 1));

      scene.events.on(Phaser.Scenes.Events.UPDATE, () => {
        if (!player.active || !cameraFocus.active || !shadow.active) return;

        const vx = player.body?.velocity.x ?? 0;
        const vy = player.body?.velocity.y ?? 0;
        const speed = Math.hypot(vx, vy);

        // Remember the last movement direction so the camera keeps looking forward
        // when the player stops instead of snapping back to center.
        if (speed > 8) {
          lookX = vx / speed;
          lookY = vy / speed;
        }

        const movingLead = speed > 8 ? lookAheadDistance : lookAheadDistance * 0.62;
        const targetX = player.x + lookX * movingLead;
        const targetY = player.y + lookY * movingLead;

        cameraFocus.x = Phaser.Math.Linear(cameraFocus.x, targetX, huntQuality ? 0.10 : 0.085);
        cameraFocus.y = Phaser.Math.Linear(cameraFocus.y, targetY, huntQuality ? 0.10 : 0.085);

        shadow.setPosition(player.x, player.y + shadowYOffset);
        const moving = speed > 5;
        shadow.setScale(moving ? 0.94 : 1, moving ? 0.88 : 1);
      });

      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        cameraFocus.destroy();
        shadow.destroy();
      });
    }

    // Keep the edge treatment subtle so the map remains bright and readable.
    const vignette = scene.add.graphics().setScrollFactor(0).setDepth(9998);
    const w = scene.scale.width;
    const h = scene.scale.height;
    vignette.fillStyle(0x000000, huntQuality ? 0.06 : 0.10);
    vignette.fillRect(0, 0, w, 16);
    vignette.fillRect(0, h - 16, w, 16);
    vignette.fillRect(0, 0, 16, h);
    vignette.fillRect(w - 16, 0, 16, h);
  };
}

export function installCameraPolishPatch() {
  // Larger look-ahead values put more of the world in front of the player on screen.
  polishSceneCamera(HuntScene as unknown as SceneCtor, 0.88, 42, 175, true);
  polishSceneCamera(DungeonScene as unknown as SceneCtor, 0.84, 46, 135);
  polishSceneCamera(VillageScene as unknown as SceneCtor, 0.78, 46, 160);
}
