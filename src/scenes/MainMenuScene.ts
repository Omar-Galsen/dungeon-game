import Phaser from "phaser";

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
  }

  preload() {
    this.load.image("menuDungeon", "./assets/maps/Dungeon 2 Cavern Map.png");
    this.load.image("menuHero", "./assets/sprites/sword/idle/sword_idle_down_1.png");
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#07090d");

    const background = this.add.image(width / 2, height / 2, "menuDungeon");
    background.setDisplaySize(width, height);
    background.setAlpha(0.28);

    const darkOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x05070b, 0.64);
    darkOverlay.setDepth(1);

    const glow = this.add.circle(width / 2, 205, 170, 0x6d28d9, 0.16);
    glow.setDepth(2);
    this.tweens.add({
      targets: glow,
      scale: 1.15,
      alpha: 0.28,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const title = this.add.text(width / 2, 105, "DUNGEON HUNTER", {
      fontFamily: "Georgia",
      fontSize: "54px",
      fontStyle: "bold",
      color: "#f5d76e",
      stroke: "#000000",
      strokeThickness: 8,
      shadow: { offsetX: 0, offsetY: 4, color: "#000000", blur: 8, fill: true },
    });
    title.setOrigin(0.5).setDepth(3);

    const subtitle = this.add.text(width / 2, 165, "Explore. Hunt. Survive. Descend deeper.", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#ddd6fe",
      stroke: "#000000",
      strokeThickness: 4,
    });
    subtitle.setOrigin(0.5).setDepth(3);

    const hero = this.add.image(width / 2, 278, "menuHero");
    hero.setDisplaySize(150, 200);
    hero.setDepth(3);
    this.tweens.add({
      targets: hero,
      y: 268,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    const panel = this.add.rectangle(width / 2, 492, 390, 260, 0x111827, 0.94);
    panel.setStrokeStyle(3, 0xc9a227, 0.95);
    panel.setDepth(3);

    this.createButton(width / 2, 420, "START GAME", () => this.startNewGame());
    this.createButton(width / 2, 480, "CONTINUE", () => this.continueGame());
    this.createButton(width / 2, 540, "CONTROLS", () => this.showControls());

    const tip = this.add.text(width / 2, 615, "WASD / Arrows: Move   •   J: Attack   •   X: Interact", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#cbd5e1",
      stroke: "#000000",
      strokeThickness: 4,
    });
    tip.setOrigin(0.5).setDepth(3);

    const footer = this.add.text(width / 2, 670, "Dungeon Hunter • Adventure RPG", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#94a3b8",
    });
    footer.setOrigin(0.5).setDepth(3);
  }

  private createButton(x: number, y: number, label: string, onClick: () => void) {
    const button = this.add.rectangle(x, y, 290, 46, 0x1f2937, 1);
    button.setStrokeStyle(2, 0xf5d76e, 0.9);
    button.setInteractive({ useHandCursor: true });
    button.setDepth(4);

    const text = this.add.text(x, y, label, {
      fontFamily: "Arial",
      fontSize: "20px",
      fontStyle: "bold",
      color: "#ffffff",
    });
    text.setOrigin(0.5).setDepth(5);

    button.on("pointerover", () => {
      button.setFillStyle(0x312e81, 1);
      button.setScale(1.04);
      text.setScale(1.04);
    });

    button.on("pointerout", () => {
      button.setFillStyle(0x1f2937, 1);
      button.setScale(1);
      text.setScale(1);
    });

    button.on("pointerdown", onClick);
  }

  private startNewGame() {
    this.registry.set("playerRubies", 0);
    this.registry.set("playerHealth", 100);
    this.registry.set("hasSword", false);
    this.registry.set("huntCleared", false);
    this.registry.set("dungeonTwoUnlocked", false);
    this.registry.set("slimeDefeated", false);
    this.registry.set("slime2Defeated", false);
    for (let i = 3; i <= 8; i++) this.registry.set(`huntSlimeDefeated_${i}`, false);
    this.registry.set("lastScene", "GameScene");
    this.scene.start("GameScene");
  }

  private continueGame() {
    const scene = this.registry.get("lastScene");
    const destination = scene === "DungeonScene" || scene === "HuntScene" || scene === "GameScene" ? scene : "GameScene";
    this.scene.start(destination);
  }

  private showControls() {
    const { width, height } = this.scale;
    const overlay = this.add.container(0, 0).setDepth(100);

    const shade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75);
    const card = this.add.rectangle(width / 2, height / 2, 560, 360, 0x111827, 0.98);
    card.setStrokeStyle(3, 0xc9a227, 1);

    const title = this.add.text(width / 2, height / 2 - 130, "CONTROLS", {
      fontFamily: "Georgia",
      fontSize: "32px",
      fontStyle: "bold",
      color: "#f5d76e",
    }).setOrigin(0.5);

    const body = this.add.text(width / 2, height / 2 - 45,
      "WASD / Arrow Keys  —  Move\nJ  —  Sword / Punch Attack\nX  —  Interact / Enter / Return\nSPACE  —  Dialogue / Shop",
      {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#ffffff",
        align: "center",
        lineSpacing: 12,
      }
    ).setOrigin(0.5);

    const close = this.add.text(width / 2, height / 2 + 125, "CLICK TO CLOSE", {
      fontFamily: "Arial",
      fontSize: "18px",
      fontStyle: "bold",
      color: "#c4b5fd",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    overlay.add([shade, card, title, body, close]);
    shade.setInteractive();
    shade.on("pointerdown", () => overlay.destroy(true));
    close.on("pointerdown", () => overlay.destroy(true));
  }
}
