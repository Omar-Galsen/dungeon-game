import Phaser from "phaser";
import HuntScene from "../scenes/HuntScene";

type HuntSceneAny = HuntScene & Record<string, any>;

export function installHuntAttackPatch() {
  const proto = HuntScene.prototype as unknown as Record<string, any>;

  const originalPreload = proto.preload;
  proto.preload = function (this: HuntSceneAny) {
    originalPreload.call(this);

    for (const direction of ["down", "up", "left", "right"]) {
      for (let i = 1; i <= 2; i++) {
        this.load.image(
          `punch_${direction}_${i}`,
          `./assets/sprites/punch/punch_${direction}_${i}.png`
        );
      }
    }

    for (let i = 1; i <= 4; i++) {
      this.load.image(
        `slash_effect_${i}`,
        `./assets/sprites/effects/slash_${i}.png`
      );
    }
  };

  const originalCreatePlayerAnimations = proto.createPlayerAnimations;
  proto.createPlayerAnimations = function (this: HuntSceneAny) {
    originalCreatePlayerAnimations.call(this);

    for (const direction of ["down", "up", "left", "right"]) {
      const key = `punch_${direction}`;
      if (!this.anims.exists(key)) {
        this.anims.create({
          key,
          frames: [1, 2, 1].map((i) => ({ key: `punch_${direction}_${i}` })),
          frameRate: 14,
          repeat: 0,
        });
      }
    }

    if (!this.anims.exists("slash_effect")) {
      this.anims.create({
        key: "slash_effect",
        frames: [1, 2, 3, 4].map((i) => ({ key: `slash_effect_${i}` })),
        frameRate: 24,
        repeat: 0,
      });
    }
  };

  proto.showSlashSpriteEffect = function (this: HuntSceneAny) {
    const direction = this.currentDirection as string;
    let offsetX = 0;
    let offsetY = 0;
    let angle = 0;

    if (direction === "up") {
      offsetY = -48;
      angle = -90;
    } else if (direction === "down") {
      offsetY = 48;
      angle = 90;
    } else if (direction === "left") {
      offsetX = -48;
      angle = 180;
    } else {
      offsetX = 48;
      angle = 0;
    }

    const slash = this.add.sprite(
      this.player.x + offsetX,
      this.player.y + offsetY,
      "slash_effect_1"
    );

    slash.setDepth(45);
    slash.setDisplaySize(92, 92);
    slash.setAngle(angle);
    slash.play("slash_effect");
    slash.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => slash.destroy());
  };

  proto.playPunchAttack = function (this: HuntSceneAny) {
    this.punchPlaying = true;
    this.player.setVelocity(0, 0);

    const direction = this.currentDirection as string;
    const key = `punch_${direction}`;

    this.player.play(key, true);
    this.setPlayerSize();
    this.updatePlayerBody();

    if (typeof this.showPunchEffect === "function") {
      this.time.delayedCall(55, () => this.showPunchEffect());
    }

    this.player.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.punchPlaying = false;
      this.player.anims.stop();
      this.player.setTexture(`char_${direction}_1`);
      this.setPlayerSize();
      this.updatePlayerBody();
    });
  };

  const originalPlaySwordAttack = proto.playSwordAttack;
  proto.playSwordAttack = function (this: HuntSceneAny) {
    originalPlaySwordAttack.call(this);
    this.time.delayedCall(70, () => {
      if (typeof this.showSlashSpriteEffect === "function") {
        this.showSlashSpriteEffect();
      }
    });
  };
}
