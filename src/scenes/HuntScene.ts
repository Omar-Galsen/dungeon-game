import Phaser from "phaser";

type CollisionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CollisionData = {
  mapWidth: number;
  mapHeight: number;
  coordinateMode: string;
  boxes: CollisionBox[];
};

enum Animation {
  Down = "down",
  Up = "up",
  Left = "left",
  Right = "right",
}

export default class HuntScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private walls!: Phaser.Physics.Arcade.StaticGroup;

  private slime!: Phaser.Physics.Arcade.Sprite;
  private slimeHP = 30;
  private slimeAlive = true;
  private slimeDirection = 1;

  // Second slime
  private slime2!: Phaser.Physics.Arcade.Sprite;
  private slime2HP = 30;
  private slime2Alive = true;
  private slime2Direction = 1;

  // Three hearts are displayed above each slime.
  private slimeHealthHearts: Phaser.GameObjects.Image[] = [];
  private slime2HealthHearts: Phaser.GameObjects.Image[] = [];

  private cursors!: Record<
    "w" | "a" | "s" | "d" | "up" | "left" | "down" | "right",
    Phaser.Input.Keyboard.Key
  >;

  private attackKey!: Phaser.Input.Keyboard.Key;
  private exitKey!: Phaser.Input.Keyboard.Key;
  private restartKey!: Phaser.Input.Keyboard.Key;

  private currentDirection: Animation = Animation.Down;

  private readonly PLAYER_HEIGHT = 72;
  private readonly PLAYER_SPEED = 180;

  private health = 100;
  private maxHealth = 100;
  private rubies = 0;
  private hasSword = false;

  private healthBar!: Phaser.GameObjects.Rectangle;
  private healthText!: Phaser.GameObjects.Text;
  private rubyText!: Phaser.GameObjects.Text;

  private attackCooldown = 0;
  private slimeDamageCooldown = 0;
  private attackFlash?: Phaser.GameObjects.Graphics;
  private swordAttackPlaying = false;
  private punchPlaying = false;

  private rewardPopup?: Phaser.GameObjects.Container;
  private rewardPopupOpen = false;
  private gameOver = false;
  private gameOverContainer?: Phaser.GameObjects.Container;

  private readonly SLIME_X = 1530;
  private readonly SLIME_TOP_Y = 690;
  private readonly SLIME_BOTTOM_Y = 790;
  private readonly SLIME_HEIGHT = 56;
  private readonly SLIME_SPEED = 60;

  // SECOND SLIME TEST POSITION
  // Change these values after testing the game.
  private readonly SLIME2_X = 1350;
  private readonly SLIME2_TOP_Y = 900;
  private readonly SLIME2_BOTTOM_Y = 1000;
  private readonly SLIME2_SPEED = 60;

  private readonly CAVE_X = 1715;
  private readonly CAVE_Y = 400;
  private readonly CAVE_DISTANCE = 115;

  private caveLabel!: Phaser.GameObjects.Container;
  private caveHint!: Phaser.GameObjects.Text;

  constructor() {
    super("HuntScene");
  }

  preload() {
    this.load.image("huntingMap", "./assets/maps/HuntingG.png");
    this.load.image("dialogue_box", "./assets/sprites/ui/dialogue_box.png");
    this.load.image("player_face", "./assets/sprites/portraits/player_face.png");
    this.load.image("heart_full", "./assets/sprites/items/heart_full.png");
    this.load.image("heart_empty", "./assets/sprites/items/heart_empty.png");

    // Normal player walking = 4 frames.
    for (let i = 1; i <= 4; i++) {
      this.load.image(
        `char_down_${i}`,
        `./assets/sprites/player/char_down_${i}.png`
      );
      this.load.image(
        `char_up_${i}`,
        `./assets/sprites/player/char_up_${i}.png`
      );
      this.load.image(
        `char_left_${i}`,
        `./assets/sprites/player/char_left_${i}.png`
      );
      this.load.image(
        `char_right_${i}`,
        `./assets/sprites/player/char_right_${i}.png`
      );
    }

    // NEW: smooth sword walking = 8 frames per direction.
    for (let i = 1; i <= 8; i++) {
      this.load.image(
        `sword_walk_down_${i}`,
        `./assets/sprites/sword/walk/sword_walk_down_${i}.png`
      );
      this.load.image(
        `sword_walk_up_${i}`,
        `./assets/sprites/sword/walk/sword_walk_up_${i}.png`
      );
      this.load.image(
        `sword_walk_left_${i}`,
        `./assets/sprites/sword/walk/sword_walk_left_${i}.png`
      );
      this.load.image(
        `sword_walk_right_${i}`,
        `./assets/sprites/sword/walk/sword_walk_right_${i}.png`
      );
    }

    // Smooth sword attack = 8 frames per direction.
    for (let i = 1; i <= 8; i++) {
      this.load.image(
        `sword_attack_down_${i}`,
        `./assets/sprites/sword/attack/sword_attack_down_${i}.png`
      );
      this.load.image(
        `sword_attack_up_${i}`,
        `./assets/sprites/sword/attack/sword_attack_up_${i}.png`
      );
      this.load.image(
        `sword_attack_left_${i}`,
        `./assets/sprites/sword/attack/sword_attack_left_${i}.png`
      );
      this.load.image(
        `sword_attack_right_${i}`,
        `./assets/sprites/sword/attack/sword_attack_right_${i}.png`
      );
    }

    // Smooth slime sprites.
    for (let i = 1; i <= 4; i++) {
      this.load.image(
        `slime_idle_${i}`,
        `./assets/sprites/slimes/idle/slime_idle_${i}.png`
      );
    }

    for (let i = 1; i <= 8; i++) {
      this.load.image(
        `slime_move_${i}`,
        `./assets/sprites/slimes/move/slime_move_${i}.png`
      );
    }

    this.load.json(
      "huntingCollisions",
      "./assets/data/hunting_collisions.json"
    );
  }

  private createPlayerAnimations() {
    const directions = ["down", "up", "left", "right"];

    for (const direction of directions) {
      const swordWalkKey = `sword_walk_${direction}`;

      if (!this.anims.exists(swordWalkKey)) {
        this.anims.create({
          key: swordWalkKey,
          frames: Array.from({ length: 8 }, (_, index) => ({
            key: `sword_walk_${direction}_${index + 1}`,
          })),
          // 8 frames gives a much smoother walk cycle.
          frameRate: 12,
          repeat: -1,
        });
      }

      const swordAttackKey = `sword_attack_${direction}`;

      if (!this.anims.exists(swordAttackKey)) {
        this.anims.create({
          key: swordAttackKey,
          frames: Array.from({ length: 8 }, (_, index) => ({
            key: `sword_attack_${direction}_${index + 1}`,
          })),
          // Fast enough to make the 8-frame attack feel fluid.
          frameRate: 20,
          repeat: 0,
        });
      }

      const normalWalkKey = `normal_walk_${direction}`;

      if (!this.anims.exists(normalWalkKey)) {
        this.anims.create({
          key: normalWalkKey,
          frames: [1, 2, 3, 4].map((i) => ({
            key: `char_${direction}_${i}`,
          })),
          frameRate: 12,
          repeat: -1,
        });
      }
    }
  }

  private createSlimeAnimations() {
    if (!this.anims.exists("slime_idle")) {
      this.anims.create({
        key: "slime_idle",
        frames: [1, 2, 3, 4].map((i) => ({
          key: `slime_idle_${i}`,
        })),
        frameRate: 8,
        repeat: -1,
      });
    }

    if (!this.anims.exists("slime_move")) {
      this.anims.create({
        key: "slime_move",
        frames: Array.from({ length: 8 }, (_, index) => ({
          key: `slime_move_${index + 1}`,
        })),
        frameRate: 12,
        repeat: -1,
      });
    }
  }

  create() {
    this.createPlayerAnimations();
    this.createSlimeAnimations();

    const savedRubies = this.registry.get("playerRubies");
    this.rubies = typeof savedRubies === "number" ? savedRubies : 0;
    this.hasSword = this.registry.get("hasSword") === true;

    if (typeof savedRubies !== "number") {
      this.registry.set("playerRubies", 0);
    }

    const savedHealth = this.registry.get("playerHealth");
    this.health = typeof savedHealth === "number" ? savedHealth : 100;

    if (typeof savedHealth !== "number") {
      this.registry.set("playerHealth", 100);
    }

    const map = this.add
      .image(0, 0, "huntingMap")
      .setOrigin(0, 0)
      .setDisplaySize(3000, 3000);

    map.setDepth(0);

    this.physics.world.setBounds(0, 0, 3000, 3000);
    this.walls = this.physics.add.staticGroup();

    const data = this.cache.json.get(
      "huntingCollisions"
    ) as CollisionData | null;

    if (data?.boxes) {
      data.boxes.forEach((box) => {
        const width = box.width * 3000;
        const height = box.height * 3000;
        const x = box.x * 3000 + width / 2;
        const y = box.y * 3000 + height / 2;

        const wall = this.walls.create(
          x,
          y,
          undefined
        ) as Phaser.Physics.Arcade.Image;

        wall.setVisible(false);
        wall.setDisplaySize(width, height);
        wall.refreshBody();
      });
    }

    this.player = this.physics.add.sprite(
      1715,
      455,
      this.hasSword ? "sword_walk_down_1" : "char_down_1"
    );

    this.player.setDepth(20);
    this.player.setCollideWorldBounds(true);
    this.player.setPipeline(undefined);

    this.setPlayerSize();
    this.updatePlayerBody();

    this.physics.add.collider(this.player, this.walls);

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error("Keyboard input unavailable.");
    }

    this.cursors = {
      w: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
    };

    this.attackKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.exitKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.restartKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Reset keyboard state whenever HuntScene is entered again.
    // This prevents the X/SPACE key used during a scene transition
    // from leaving the new HuntScene in a stuck/frozen input state.
    keyboard.resetKeys();
    this.attackCooldown = 0;
    this.slimeDamageCooldown = 0;
    this.swordAttackPlaying = false;
    this.punchPlaying = false;
    this.gameOver = false;
    this.rewardPopupOpen = false;

    this.createSlime();
    this.createSlime2();
    this.createCaveLabel();
    this.createHUD();

    this.cameras.main.setBounds(0, 0, 3000, 3000);
    this.cameras.main.startFollow(
      this.player,
      true,
      0.10,
      0.10
    );

    this.rubyText.setText(`♦  Rubies: ${this.rubies}`);
    this.updateHealthBar();
  }

  update(_time: number, delta: number) {
    if (this.gameOver) {
      // Keep checking SPACE even while the normal game update is paused.
      if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
        this.registry.set("playerHealth", 100);
        this.scene.start("GameScene");
      }
      return;
    }

    this.attackCooldown -= delta;
    this.slimeDamageCooldown -= delta;

    if (this.rewardPopupOpen) {
      this.player.setVelocity(0, 0);

      if (Phaser.Input.Keyboard.JustDown(this.exitKey)) {
        this.closeRewardPopup();
      }

      return;
    }

    let dx = 0;
    let dy = 0;
    let moving = false;

    if (this.cursors.w.isDown || this.cursors.up.isDown) {
      dy = -1;
      moving = true;
      this.currentDirection = Animation.Up;
    }

    if (this.cursors.s.isDown || this.cursors.down.isDown) {
      dy = 1;
      moving = true;
      this.currentDirection = Animation.Down;
    }

    if (this.cursors.a.isDown || this.cursors.left.isDown) {
      dx = -1;
      moving = true;
      this.currentDirection = Animation.Left;
    }

    if (this.cursors.d.isDown || this.cursors.right.isDown) {
      dx = 1;
      moving = true;
      this.currentDirection = Animation.Right;
    }

    if (dx !== 0 && dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy);
      dx /= length;
      dy /= length;
    }

    this.player.setVelocity(
      dx * this.PLAYER_SPEED,
      dy * this.PLAYER_SPEED
    );

    if (moving && !this.swordAttackPlaying && !this.punchPlaying) {
      this.updatePlayerFrame();
    } else if (!this.swordAttackPlaying && !this.punchPlaying) {
      this.player.anims.stop();

      if (this.hasSword) {
        this.player.setTexture(
          `sword_walk_${this.currentDirection}_1`
        );
      } else {
        this.player.setTexture(
          `char_${this.currentDirection}_1`
        );
      }

      this.setPlayerSize();
      this.updatePlayerBody();
    }

    this.updateSlime(delta);
    this.updateSlime2(delta);
    this.updateAllSlimeHealthHearts();
    this.checkSlimeContactDamage();

    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
      this.attack();
    }

    if (Phaser.Input.Keyboard.JustDown(this.exitKey)) {
      this.tryEnterCave();
    }
  }

  private setPlayerSize() {
    const source = this.player.texture.getSourceImage();

    if (source.height > 0) {
      this.player.setScale(
        this.PLAYER_HEIGHT / source.height
      );
    }
  }

  private updatePlayerBody() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    body.setSize(
      this.player.displayWidth * 0.55,
      this.player.displayHeight * 0.70
    );

    body.setOffset(
      this.player.displayWidth * 0.225,
      this.player.displayHeight * 0.25
    );
  }

  private updatePlayerFrame() {
    const prefix = this.hasSword
      ? "sword_walk"
      : "normal_walk";

    const key = `${prefix}_${this.currentDirection}`;

    if (
      !this.player.anims.isPlaying ||
      this.player.anims.currentAnim?.key !== key
    ) {
      this.player.play(key, true);
    }

    this.setPlayerSize();
    this.updatePlayerBody();
  }

  private createSlime() {
    if (this.registry.get("slimeDefeated") === true) {
      this.slimeAlive = false;
      return;
    }

    this.slimeAlive = true;
    this.slimeHP = 30;
    this.slimeDirection = 1;

    this.slime = this.physics.add.sprite(
      this.SLIME_X,
      this.SLIME_TOP_Y,
      "slime_idle_1"
    );

    this.slime.setDepth(15);
    this.slime.setCollideWorldBounds(true);

    // All generated slime frames share a 128x128 canvas.
    // Keeping the display size fixed prevents animation jitter.
    this.slime.setDisplaySize(
      this.SLIME_HEIGHT,
      this.SLIME_HEIGHT
    );

    const body = this.slime.body as Phaser.Physics.Arcade.Body;

    body.setSize(
      this.SLIME_HEIGHT * 0.70,
      this.SLIME_HEIGHT * 0.62
    );

    body.setOffset(
      this.SLIME_HEIGHT * 0.15,
      this.SLIME_HEIGHT * 0.22
    );

    this.slime.play("slime_idle");

    this.createSlimeHealthHearts(
      this.slime,
      this.slimeHealthHearts
    );
  }

  private createSlimeHealthHearts(
    slime: Phaser.Physics.Arcade.Sprite,
    hearts: Phaser.GameObjects.Image[]
  ) {
    for (const heart of hearts) {
      heart.destroy();
    }

    hearts.length = 0;

    for (let i = 0; i < 3; i++) {
      const heart = this.add.image(
        slime.x - 24 + i * 24,
        slime.y - 48,
        "heart_full"
      );

      heart.setDisplaySize(20, 20);
      heart.setDepth(100);
      hearts.push(heart);
    }
  }

  private updateSlimeHealthHearts(
    slime: Phaser.Physics.Arcade.Sprite,
    hp: number,
    hearts: Phaser.GameObjects.Image[]
  ) {
    if (!slime || !slime.active) {
      return;
    }

    const fullHearts = Math.floor(
      Phaser.Math.Clamp(hp, 0, 30) / 10
    );

    for (let i = 0; i < hearts.length; i++) {
      hearts[i].setPosition(
        slime.x - 24 + i * 24,
        slime.y - 48
      );

      hearts[i].setTexture(
        i < fullHearts ? "heart_full" : "heart_empty"
      );
      hearts[i].setVisible(true);
    }
  }

  private updateAllSlimeHealthHearts() {
    if (this.slimeAlive && this.slime?.active) {
      this.updateSlimeHealthHearts(
        this.slime,
        this.slimeHP,
        this.slimeHealthHearts
      );
    }

    if (this.slime2Alive && this.slime2?.active) {
      this.updateSlimeHealthHearts(
        this.slime2,
        this.slime2HP,
        this.slime2HealthHearts
      );
    }
  }

  private updateSlime(delta: number) {
    if (!this.slimeAlive || !this.slime?.active) {
      return;
    }

    this.slime.y +=
      this.slimeDirection *
      this.SLIME_SPEED *
      (delta / 1000);

    if (this.slime.y >= this.SLIME_BOTTOM_Y) {
      this.slime.y = this.SLIME_BOTTOM_Y;
      this.slimeDirection = -1;
    } else if (this.slime.y <= this.SLIME_TOP_Y) {
      this.slime.y = this.SLIME_TOP_Y;
      this.slimeDirection = 1;
    }

    this.slime.setVelocity(0, 0);

    if (
      !this.slime.anims.isPlaying ||
      this.slime.anims.currentAnim?.key !== "slime_move"
    ) {
      this.slime.play("slime_move");
    }
  }

  private createSlime2() {
    if (this.registry.get("slime2Defeated") === true) {
      this.slime2Alive = false;
      return;
    }

    this.slime2Alive = true;
    this.slime2HP = 30;
    this.slime2Direction = 1;

    this.slime2 = this.physics.add.sprite(
      this.SLIME2_X,
      this.SLIME2_TOP_Y,
      "slime_idle_1"
    );

    this.slime2.setDepth(15);
    this.slime2.setCollideWorldBounds(true);
    this.slime2.setDisplaySize(
      this.SLIME_HEIGHT,
      this.SLIME_HEIGHT
    );

    const body = this.slime2.body as Phaser.Physics.Arcade.Body;
    body.setSize(
      this.SLIME_HEIGHT * 0.70,
      this.SLIME_HEIGHT * 0.62
    );
    body.setOffset(
      this.SLIME_HEIGHT * 0.15,
      this.SLIME_HEIGHT * 0.22
    );

    this.slime2.play("slime_idle");

    this.createSlimeHealthHearts(
      this.slime2,
      this.slime2HealthHearts
    );
  }

  private updateSlime2(delta: number) {
    if (!this.slime2Alive || !this.slime2?.active) {
      return;
    }

    this.slime2.y +=
      this.slime2Direction *
      this.SLIME2_SPEED *
      (delta / 1000);

    if (this.slime2.y >= this.SLIME2_BOTTOM_Y) {
      this.slime2.y = this.SLIME2_BOTTOM_Y;
      this.slime2Direction = -1;
    } else if (this.slime2.y <= this.SLIME2_TOP_Y) {
      this.slime2.y = this.SLIME2_TOP_Y;
      this.slime2Direction = 1;
    }

    this.slime2.setVelocity(0, 0);

    if (
      !this.slime2.anims.isPlaying ||
      this.slime2.anims.currentAnim?.key !== "slime_move"
    ) {
      this.slime2.play("slime_move");
    }
  }

  private checkSlimeContactDamage() {
    if (
      this.slimeDamageCooldown > 0 ||
      this.health <= 0
    ) {
      return;
    }

    const contactDistance = 75;

    const slimes = [
      this.slimeAlive && this.slime?.active ? this.slime : null,
      this.slime2Alive && this.slime2?.active ? this.slime2 : null,
    ].filter(
      (slime): slime is Phaser.Physics.Arcade.Sprite => slime !== null
    );

    for (const slime of slimes) {
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        slime.x,
        slime.y
      );

      if (distance <= contactDistance) {
        const damage = 10;

        this.health = Math.max(0, this.health - damage);
        this.slimeDamageCooldown = 900;

        this.registry.set("playerHealth", this.health);
        this.updateHealthBar();

        const flash = this.add.rectangle(
          0,
          0,
          this.scale.width,
          this.scale.height,
          0xff0000,
          0.12
        );
        flash.setScrollFactor(0);
        flash.setDepth(1000);

        this.tweens.add({
          targets: flash,
          alpha: 0,
          duration: 180,
          onComplete: () => flash.destroy(),
        });

        const angle = Phaser.Math.Angle.Between(
          slime.x,
          slime.y,
          this.player.x,
          this.player.y
        );

        this.player.x += Math.cos(angle) * 18;
        this.player.y += Math.sin(angle) * 18;

        if (this.health <= 0) {
          this.health = 0;
          this.registry.set("playerHealth", 0);
          this.player.setVelocity(0, 0);
          this.showGameOver();
        }

        return;
      }
    }
  }

  private attack() {
    if (
      this.attackCooldown > 0 ||
      this.swordAttackPlaying ||
      this.punchPlaying
    ) {
      return;
    }

    this.attackCooldown = 350;

    // Before the player owns a sword, J performs a quick punch.
    // Once the sword is purchased, J switches to the sword attack.
    if (this.hasSword) {
      this.playSwordAttack();
    } else {
      this.playPunchAttack();
    }

    const candidates: {
      slime: Phaser.Physics.Arcade.Sprite;
      distance: number;
      id: 1 | 2;
    }[] = [];

    if (this.slimeAlive && this.slime?.active) {
      candidates.push({
        slime: this.slime,
        distance: Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          this.slime.x,
          this.slime.y
        ),
        id: 1,
      });
    }

    if (this.slime2Alive && this.slime2?.active) {
      candidates.push({
        slime: this.slime2,
        distance: Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          this.slime2.x,
          this.slime2.y
        ),
        id: 2,
      });
    }

    candidates.sort((a, b) => a.distance - b.distance);

    const target = candidates[0];

    if (!target || target.distance > 105) {
      if (!this.hasSword) {
        this.showAttackEffect(false);
      }
      return;
    }

    if (!this.hasSword) {
      this.showAttackEffect(true);
    }

    if (target.id === 1) {
      this.slimeHP -= 10;
      this.updateSlimeHealthHearts(
        this.slime,
        this.slimeHP,
        this.slimeHealthHearts
      );

      if (this.slimeHP <= 0) {
        this.killSlime();
      }
    } else {
      this.slime2HP -= 10;
      this.updateSlimeHealthHearts(
        this.slime2,
        this.slime2HP,
        this.slime2HealthHearts
      );

      if (this.slime2HP <= 0) {
        this.killSlime2();
      }
    }
  }

  private playPunchAttack() {
    this.punchPlaying = true;

    // Save the starting position so the lunge always returns exactly
    // where the player started. This makes the punch feel responsive
    // without permanently moving the character.
    const startX = this.player.x;
    const startY = this.player.y;

    let dx = 0;
    let dy = 0;

    if (this.currentDirection === Animation.Up) dy = -1;
    if (this.currentDirection === Animation.Down) dy = 1;
    if (this.currentDirection === Animation.Left) dx = -1;
    if (this.currentDirection === Animation.Right) dx = 1;

    const punchDistance = 18;

    // Three very quick phases:
    // 1. Pull back
    // 2. Punch forward
    // 3. Return
    this.tweens.add({
      targets: this.player,
      x: startX - dx * 5,
      y: startY - dy * 5,
      duration: 45,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.showPunchEffect();

        this.tweens.add({
          targets: this.player,
          x: startX + dx * punchDistance,
          y: startY + dy * punchDistance,
          duration: 65,
          ease: "Quad.easeOut",
          onComplete: () => {
            this.tweens.add({
              targets: this.player,
              x: startX,
              y: startY,
              duration: 75,
              ease: "Quad.easeIn",
              onComplete: () => {
                this.punchPlaying = false;

                // Return immediately to the correct walking/idle state.
                const body = this.player.body as Phaser.Physics.Arcade.Body;

                if (
                  body &&
                  (Math.abs(body.velocity.x) > 0 ||
                    Math.abs(body.velocity.y) > 0)
                ) {
                  this.updatePlayerFrame();
                } else {
                  this.player.anims.stop();
                  this.player.setTexture(
                    `char_${this.currentDirection}_1`
                  );
                  this.setPlayerSize();
                  this.updatePlayerBody();
                }
              },
            });
          },
        });
      },
    });
  }

  private showPunchEffect() {
    const g = this.add.graphics();
    g.setDepth(40);

    let angle = 0;

    if (this.currentDirection === Animation.Up) {
      angle = -Math.PI / 2;
    } else if (this.currentDirection === Animation.Down) {
      angle = Math.PI / 2;
    } else if (this.currentDirection === Animation.Left) {
      angle = Math.PI;
    }

    const fistX =
      this.player.x + Math.cos(angle) * 30;
    const fistY =
      this.player.y + Math.sin(angle) * 30;

    // Small impact ring/fist indicator.
    g.fillStyle(0xf4c27a, 1);
    g.fillCircle(fistX, fistY, 9);

    g.lineStyle(4, 0xffffff, 0.85);
    g.strokeCircle(fistX, fistY, 15);

    this.tweens.add({
      targets: g,
      scaleX: 1.45,
      scaleY: 1.45,
      alpha: 0,
      duration: 110,
      ease: "Quad.easeOut",
      onComplete: () => g.destroy(),
    });

    this.attackFlash = g;
  }

  private playSwordAttack() {
    this.swordAttackPlaying = true;

    const key = `sword_attack_${this.currentDirection}`;

    this.player.play(key, true);

    this.setPlayerSize();
    this.updatePlayerBody();

    this.player.once(
      Phaser.Animations.Events.ANIMATION_COMPLETE,
      () => {
        this.swordAttackPlaying = false;

        const body = this.player.body as Phaser.Physics.Arcade.Body;

        if (
          body &&
          (
            Math.abs(body.velocity.x) > 0 ||
            Math.abs(body.velocity.y) > 0
          )
        ) {
          this.updatePlayerFrame();
        } else {
          this.player.anims.stop();

          this.player.setTexture(
            `sword_walk_${this.currentDirection}_1`
          );

          this.setPlayerSize();
          this.updatePlayerBody();
        }
      }
    );
  }

  private showAttackEffect(hit: boolean) {
    this.attackFlash?.destroy();

    const g = this.add.graphics();
    g.setDepth(40);

    let angle = Phaser.Math.DegToRad(90);

    const targets: Phaser.Physics.Arcade.Sprite[] = [];

    if (this.slimeAlive && this.slime?.active) {
      targets.push(this.slime);
    }

    if (this.slime2Alive && this.slime2?.active) {
      targets.push(this.slime2);
    }

    if (targets.length > 0) {
      targets.sort(
        (a, b) =>
          Phaser.Math.Distance.Between(
            this.player.x,
            this.player.y,
            a.x,
            a.y
          ) -
          Phaser.Math.Distance.Between(
            this.player.x,
            this.player.y,
            b.x,
            b.y
          )
      );

      angle = Phaser.Math.Angle.Between(
        this.player.x,
        this.player.y,
        targets[0].x,
        targets[0].y
      );
    } else {
      if (this.currentDirection === Animation.Up) angle = -Math.PI / 2;
      if (this.currentDirection === Animation.Down) angle = Math.PI / 2;
      if (this.currentDirection === Animation.Left) angle = Math.PI;
      if (this.currentDirection === Animation.Right) angle = 0;
    }

    g.lineStyle(7, hit ? 0xf5d76e : 0xffffff, 0.9);
    g.beginPath();
    g.arc(
      this.player.x,
      this.player.y,
      55,
      angle - 0.75,
      angle + 0.75
    );
    g.strokePath();

    this.attackFlash = g;

    this.time.delayedCall(120, () => {
      g.destroy();
      if (this.attackFlash === g) {
        this.attackFlash = undefined;
      }
    });
  }

  private killSlime() {
    this.slimeAlive = false;
    this.registry.set("slimeDefeated", true);

    this.slime.setVisible(false);
    this.slime.disableBody(true, true);

    for (const heart of this.slimeHealthHearts) {
      heart.destroy();
    }
    this.slimeHealthHearts = [];

    this.giveSlimeReward(this.slime.x, this.slime.y);
  }

  private killSlime2() {
    this.slime2Alive = false;
    this.registry.set("slime2Defeated", true);

    this.slime2.setVisible(false);
    this.slime2.disableBody(true, true);

    for (const heart of this.slime2HealthHearts) {
      heart.destroy();
    }
    this.slime2HealthHearts = [];

    this.giveSlimeReward(this.slime2.x, this.slime2.y);
  }

  private giveSlimeReward(x: number, y: number) {
    this.rubies += 20;

    this.registry.set(
      "playerRubies",
      this.rubies
    );

    this.rubyText.setText(
      `♦  Rubies: ${this.rubies}`
    );

    this.showSwordQuestPopup();

    const reward = this.add.text(
      x,
      y - 35,
      "+20 RUBIES",
      {
        fontFamily: "Georgia",
        fontSize: "22px",
        fontStyle: "bold",
        color: "#f5d76e",
        stroke: "#000000",
        strokeThickness: 5,
      }
    );

    reward.setOrigin(0.5);
    reward.setDepth(100);

    this.tweens.add({
      targets: reward,
      y: reward.y - 45,
      alpha: 0,
      duration: 1200,
      ease: "Cubic.easeOut",
      onComplete: () => reward.destroy(),
    });
  }

  private showGameOver() {
    if (this.gameOver) return;

    this.gameOver = true;
    this.player.setVelocity(0, 0);
    this.player.anims.stop();

    this.gameOverContainer = this.add.container(
      this.scale.width / 2,
      this.scale.height / 2
    );

    this.gameOverContainer.setScrollFactor(0);
    this.gameOverContainer.setDepth(2000);

    const shade = this.add.rectangle(
      0,
      0,
      this.scale.width,
      this.scale.height,
      0x000000,
      0.78
    );

    shade.setOrigin(0.5);

    const panel = this.add.rectangle(
      0,
      0,
      620,
      300,
      0x111827,
      0.98
    );

    panel.setStrokeStyle(4, 0xc9a227, 1);

    const title = this.add.text(
      0,
      -75,
      "GAME OVER",
      {
        fontFamily: "Georgia",
        fontSize: "52px",
        fontStyle: "bold",
        color: "#f5d76e",
        stroke: "#000000",
        strokeThickness: 6,
      }
    );

    title.setOrigin(0.5);

    const message = this.add.text(
      0,
      0,
      "You ran out of health.",
      {
        fontFamily: "Arial",
        fontSize: "24px",
        fontStyle: "bold",
        color: "#ffffff",
      }
    );

    message.setOrigin(0.5);

    const restart = this.add.text(
      0,
      70,
      "Press SPACE to restart",
      {
        fontFamily: "Arial",
        fontSize: "20px",
        fontStyle: "bold",
        color: "#f8fafc",
      }
    );

    restart.setOrigin(0.5);

    this.gameOverContainer.add([
      shade,
      panel,
      title,
      message,
      restart,
    ]);


  }

  private showSwordQuestPopup() {
    if (this.rewardPopup) {
      this.rewardPopup.destroy(true);
    }

    this.rewardPopupOpen = true;

    this.rewardPopup = this.add.container(
      this.scale.width / 2,
      this.scale.height / 2
    );

    this.rewardPopup.setScrollFactor(0);
    this.rewardPopup.setDepth(500);

    const shade = this.add.rectangle(
      0,
      0,
      this.scale.width,
      this.scale.height,
      0x000000,
      0.55
    );

    shade.setOrigin(0.5);

    const panel = this.add.image(
      0,
      0,
      "dialogue_box"
    );

    panel.setDisplaySize(720, 180);

    const portrait = this.add.image(
      -285,
      0,
      "player_face"
    );

    portrait.setDisplaySize(82, 82);

    const title = this.add.text(
      -220,
      -62,
      "PLAYER",
      {
        fontFamily: "Georgia",
        fontSize: "20px",
        fontStyle: "bold",
        color: "#8b5e34",
      }
    );

    const message = this.add.text(
      -220,
      -28,
      "You've earned 20 rubies!\n\nGo get a sword for 20 rubies!",
      {
        fontFamily: "Arial",
        fontSize: "20px",
        fontStyle: "bold",
        color: "#2b2118",
        wordWrap: {
          width: 500,
        },
        lineSpacing: 4,
      }
    );

    const hint = this.add.text(
      315,
      60,
      "X  Continue",
      {
        fontFamily: "Arial",
        fontSize: "15px",
        fontStyle: "bold",
        color: "#4b3621",
      }
    );

    hint.setOrigin(1, 0.5);

    this.rewardPopup.add([
      shade,
      panel,
      portrait,
      title,
      message,
      hint,
    ]);
  }

  private closeRewardPopup() {
    this.rewardPopupOpen = false;

    if (this.rewardPopup) {
      this.rewardPopup.destroy(true);
      this.rewardPopup = undefined;
    }
  }

  private createCaveLabel() {
    this.caveLabel = this.add.container(
      this.CAVE_X,
      this.CAVE_Y - 55
    );

    this.caveLabel.setDepth(60);

    const box = this.add.rectangle(
      0,
      0,
      125,
      30,
      0x111827,
      0.92
    );

    box.setStrokeStyle(
      2,
      0xc9a227,
      1
    );

    const title = this.add.text(
      0,
      0,
      "CAVE SHOP",
      {
        fontFamily: "Georgia",
        fontSize: "13px",
        fontStyle: "bold",
        color: "#f5d76e",
      }
    );

    title.setOrigin(0.5);

    this.caveHint = this.add.text(
      0,
      23,
      "X TO ENTER SHOP",
      {
        fontFamily: "Arial",
        fontSize: "11px",
        fontStyle: "bold",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
      }
    );

    this.caveHint.setOrigin(0.5);

    this.caveLabel.add([
      box,
      title,
      this.caveHint,
    ]);
  }

  private createHUD() {
    const hud = this.add.container(18, 18);

    hud.setScrollFactor(0);
    hud.setDepth(200);

    const panel = this.add.rectangle(
      2,
      3,
      336,
      143,
      0x111827,
      0.94
    );

    panel.setOrigin(0, 0);
    panel.setStrokeStyle(
      2,
      0xc9a227,
      0.95
    );

    hud.add(panel);

    const label = this.add.text(
      21,
      18,
      "HEALTH",
      {
        fontFamily: "Arial",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#f8fafc",
      }
    );

    hud.add(label);

    const healthBackground = this.add.rectangle(
      21,
      47,
      298,
      27,
      0x374151
    );

    healthBackground.setOrigin(0, 0);
    healthBackground.setStrokeStyle(
      1,
      0x9ca3af
    );

    hud.add(healthBackground);

    this.healthBar = this.add.rectangle(
      24,
      50,
      292,
      21,
      0xdc2626
    );

    this.healthBar.setOrigin(0, 0);
    hud.add(this.healthBar);

    this.healthText = this.add.text(
      21,
      82,
      "100 / 100 HP",
      {
        fontFamily: "Arial",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#ffffff",
      }
    );

    hud.add(this.healthText);

    this.rubyText = this.add.text(
      21,
      109,
      `♦  Rubies: ${this.rubies}`,
      {
        fontFamily: "Arial",
        fontSize: "18px",
        fontStyle: "bold",
        color: "#f8fafc",
      }
    );

    hud.add(this.rubyText);
  }

  private updateHealthBar() {
    const percentage = Phaser.Math.Clamp(
      this.health / this.maxHealth,
      0,
      1
    );

    this.healthBar.setDisplaySize(
      292 * percentage,
      21
    );

    this.healthText.setText(
      `${this.health} / ${this.maxHealth} HP`
    );
  }

  private tryEnterCave() {
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.CAVE_X,
      this.CAVE_Y
    );

    if (distance > this.CAVE_DISTANCE) {
      return;
    }

    this.registry.set(
      "playerRubies",
      this.rubies
    );

    this.registry.set(
      "playerHealth",
      this.health
    );

    this.scene.start("GameScene");
  }
}
