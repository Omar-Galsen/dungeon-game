import HuntScene from "../scenes/HuntScene";
import GameScene from "../scenes/GameScene";

type SceneAny = Record<string, any>;

export function installSwordProgressionPatch() {
  const huntProto = HuntScene.prototype as unknown as SceneAny;
  const gameProto = GameScene.prototype as unknown as SceneAny;

  const originalKillSlime = huntProto.killSlime;
  huntProto.killSlime = function (this: SceneAny, slime: any) {
    originalKillSlime.call(this, slime);

    const remaining = this.slimes.filter((entry: any) => entry.alive).length;
    if (remaining === 0) {
      this.registry.set("huntCleared", true);
      this.dungeonUnlocked = this.hasSword === true;

      if (this.dungeonGate) {
        this.dungeonGate.setVisible(this.dungeonUnlocked);
      }

      if (this.slimeCountText) {
        this.slimeCountText.setText(
          this.hasSword ? "NEW DUNGEON UNLOCKED!" : "RETURN TO SHOP FOR SWORD!"
        );
      }
    }
  };

  huntProto.checkDungeonUnlock = function (this: SceneAny) {
    const remaining = this.slimes.filter((slime: any) => slime.alive).length;
    const cleared = remaining === 0 || this.registry.get("huntCleared") === true;

    if (cleared) this.registry.set("huntCleared", true);

    this.dungeonUnlocked = cleared && this.hasSword === true;

    if (this.dungeonGate) {
      this.dungeonGate.setVisible(this.dungeonUnlocked);
    }

    if (this.dungeonUnlocked && this.dungeonHint) {
      this.dungeonHint.setText("X TO ENTER");
    }
  };

  huntProto.updateSlimeCountText = function (this: SceneAny) {
    const remaining = this.slimes.filter((slime: any) => slime.alive).length;

    if (remaining > 0) {
      this.slimeCountText.setText(`Slimes remaining: ${remaining}`);
      return;
    }

    this.registry.set("huntCleared", true);
    this.slimeCountText.setText(
      this.hasSword ? "NEW DUNGEON UNLOCKED!" : "RETURN TO SHOP FOR SWORD!"
    );
  };

  const originalBuySword = gameProto.buySword;
  gameProto.buySword = function (this: SceneAny) {
    if (this.registry.get("huntCleared") !== true) {
      this.swordShopOpen = false;
      this.dialogueOpen = true;
      this.dialogueContainer.setVisible(true);
      this.dialogueTitle.setText("SHOPKEEPER");
      this.dialoguePortrait.setTexture("shopkeeper_face");
      this.dialogueMessage.setText("Defeat all 8 slimes first. Then come back and I'll sell you the sword.");
      return;
    }

    originalBuySword.call(this);
  };

  gameProto.showDialogue = function (this: SceneAny) {
    const huntCleared = this.registry.get("huntCleared") === true;

    if (this.swordOwned) {
      this.dialogueTitle.setText("SHOPKEEPER");
      this.dialoguePortrait.setTexture("shopkeeper_face");
      this.dialogueMessage.setText("Your sword is ready. The next dungeon is waiting for you!");
      return;
    }

    if (!huntCleared) {
      if (this.dialogueStep === 0) {
        this.dialogueTitle.setText("SHOPKEEPER");
        this.dialoguePortrait.setTexture("shopkeeper_face");
        this.dialogueMessage.setText("Before I sell you a sword, prove yourself. Defeat all 8 slimes on the hunting map.");
        return;
      }

      this.dialogueOpen = false;
      this.dialogueFinished = false;
      this.dialogueContainer.setVisible(false);
      return;
    }

    if (this.dialogueStep === 0) {
      this.dialogueTitle.setText("SHOPKEEPER");
      this.dialoguePortrait.setTexture("shopkeeper_face");
      this.dialogueMessage.setText("You defeated all 8 slimes. You've earned the right to carry a sword.");
      return;
    }

    if (this.dialogueStep === 1) {
      this.dialogueTitle.setText("PLAYER");
      this.dialoguePortrait.setTexture("player_face");
      this.dialogueMessage.setText(`I have ${this.rubies} rubies.`);
      return;
    }

    if (this.dialogueStep === 2) {
      this.dialogueTitle.setText("SHOPKEEPER");
      this.dialoguePortrait.setTexture("shopkeeper_face");
      this.dialogueMessage.setText(
        this.rubies >= 20
          ? "Good. The sword costs 20 rubies."
          : "You defeated the slimes, but you still need 20 rubies for the sword."
      );
      return;
    }

    if (this.dialogueStep === 3 && this.rubies >= 20) {
      this.dialogueOpen = false;
      this.dialogueContainer.setVisible(false);
      this.openSwordShop();
      return;
    }

    this.dialogueOpen = false;
    this.dialogueFinished = false;
    this.dialogueContainer.setVisible(false);
  };
}
