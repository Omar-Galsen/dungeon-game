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

  // Put the next-dungeon entrance at the red-cross area shown on the hunt map.
  proto.createDungeonGate = function (this: HuntSceneAny) {
    const dungeonX = 2780;
    const dungeonY = 1150;
    this.DUNGEON_X = dungeonX;
    this.DUNGEON_Y = dungeonY;
    this.DUNGEON_DISTANCE = 180;

    this.dungeonGate = this.add.container(dungeonX, dungeonY);
    this.dungeonGate.setDepth(60);

    const arrow = this.add.text(0, 0, "➜", {
      fontFamily: "Arial",
      fontSize: "58px",
      fontStyle: "bold",
      color: "#f5d76e",
      stroke: "#000000",
      strokeThickness: 7,
    });
    arrow.setOrigin(0.5);
    arrow.setAngle(-8);

    this.dungeonHint = this.add.text(0, 48, "X TO ENTER", {
      fontFamily: "Arial",
      fontSize: "15px",
      fontStyle: "bold",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
    });
    this.dungeonHint.setOrigin(0.5);

    this.dungeonGate.add([arrow, this.dungeonHint]);
    this.dungeonGate.setVisible(false);

    this.tweens.add({
      targets: arrow,
      x: 12,
      duration: 550,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  };

  // Use the visible gate's actual position for interaction so the X prompt and
  // the entrance can never drift apart after the dungeon is moved on the map.
  proto.tryEnterDungeon = function (this: HuntSceneAny) {
    const huntCleared = this.registry.get("huntCleared") === true ||
      (this.slimes ?? []).filter((slime: any) => slime.alive).length === 0;
    const hasSword = this.registry.get("hasSword") === true || this.hasSword === true;

    if (!huntCleared || !hasSword) return false;

    const targetX = this.dungeonGate?.x ?? this.DUNGEON_X ?? 2780;
    const targetY = this.dungeonGate?.y ?? this.DUNGEON_Y ?? 1150;
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      targetX,
      targetY
    );

    if (distance > 180) return false;

    this.registry.set("playerRubies", this.rubies);
    this.registry.set("playerHealth", this.health);
    this.registry.set("dungeonTwoUnlocked", true);
    this.scene.start("DungeonScene");
    return true;
  };
}
