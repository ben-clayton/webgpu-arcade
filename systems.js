import {System, Not } from "https://ecsy.io/build/ecsy.module.js";
import { Player, PlayerBullet, Dead, Transform, Velocity, Collider,
         Health, Damage, Lifespan, Polygon } from './components.js';

//-----------------------
// Systems
//-----------------------

export class MovableSystem extends System {
  static queries = {
    moving: { components: [Velocity, Transform] }
  };

  init(attributes) {
    this.canvas = attributes.canvas;
  }

  execute(delta, time) {
    this.queries.moving.results.forEach(entity => {
      const velocity = entity.getComponent(Velocity);
      const transform = entity.getMutableComponent(Transform);
      transform.x += velocity.x * delta;
      transform.y += velocity.y * delta;

      transform.orientation += velocity.angular * delta;

      if (transform.x > this.canvas.width) { transform.x = 0; }
      if (transform.x < 0) { transform.x = this.canvas.width; }
      if (transform.y > this.canvas.height) { transform.y = 0; }
      if (transform.y < 0) { transform.y = this.canvas.height; }
    });
  }
}

export class DamageSystem extends System {
  static queries = {
    damagable: { components: [Health, Transform, Collider, Not(Dead)] },
    damaging: { components: [Damage, Transform, Collider] }
  };

  execute(delta, time) {
    const damagables = this.queries.damagable.results;

    this.queries.damaging.results.forEach(src => {
      const srcTransform = src.getComponent(Transform);
      const srcCollider = src.getComponent(Collider);
      const damage = src.getComponent(Damage);

      for (const dst of damagables) {
        // Never damage yourself.
        if (dst == src) { continue; }

        // Skip if target is immune to this type of damage
        if (dst.hasAnyComponents(damage.immune)) { continue; }

        // Don't beat dead horses.
        const health = dst.getMutableComponent(Health);
        if (health <= 0) { continue; }

        const dstTransform = dst.getComponent(Transform);
        const dstCollider = dst.getComponent(Collider);

        const distSq =
          ((srcTransform.x - dstTransform.x) * (srcTransform.x - dstTransform.x)) +
          ((srcTransform.y - dstTransform.y) * (srcTransform.y - dstTransform.y));

        let damageDistSq = dstCollider.radius + srcCollider.radius;
        damageDistSq = damageDistSq * damageDistSq;

        if (damageDistSq >= distSq) {
          health.value -= damage.value;

          if (health.value <= 0) {
            dst.addComponent(Dead);
          }
        }
      }
    });
  }
}

export class DeathSystem extends System {
  static queries = {
    lifespan: { components: [Lifespan, Not(Dead)] },
    dead: { components: [Dead] }
  };

  execute(delta, time) {
    this.queries.lifespan.results.forEach(entity => {
      let lifespan = entity.getMutableComponent(Lifespan);
      lifespan.value -= delta;
      if (lifespan.value <= 0) {
        entity.addComponent(Dead);
      }
    });

    // Bring out your dead!
    let dead = this.queries.dead.results;
    // Important to iterate in reverse order
    for (var i = dead.length - 1; i >= 0; i--) {
      // Just remove for now, later can do things like explode. :)
      dead[i].remove();
    }
  }
}

export class RenderingSystem extends System {
  static queries = {
    renderable: { components: [Polygon, Transform] }
  };

  init(attributes) {
    // Initialize canvas
    this.canvas = attributes.canvas;
    this.ctx = this.canvas.getContext("2d");
  }

  execute(delta, time) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#d4d4d4";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.queries.renderable.results.forEach(entity => {
      const polygon = entity.getComponent(Polygon);
      const transform = entity.getComponent(Transform);

      ctx.setTransform(1, 0, 0, 1, transform.x, transform.y);
      ctx.rotate(transform.orientation);

      ctx.beginPath();

      if (polygon.points.length) {
        ctx.moveTo(polygon.points[0], polygon.points[1]);
        for (let i = 2; i < polygon.points.length-1; i+=2) {
          ctx.lineTo(polygon.points[i], polygon.points[i+1]);
        }
        ctx.lineTo(polygon.points[0], polygon.points[1]);
      } else {
        const collider = entity.getComponent(Collider);
        ctx.arc(0, 0, collider ? collider.radius : 5.0, 0, 2 * Math.PI, false);
        //ctx.rect(-5, -5, 10, 10);
      }

      ctx.fillStyle = polygon.fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = polygon.stroke;
      ctx.stroke();
    });
  }
}

export class InputSystem extends System {
  static queries = {
    player: { components: [Player] }
  };

  init() {
    // Keyboard listener
    this.pressedKeys = new Array(128);
    window.addEventListener('keydown', (event) => {
      this.pressedKeys[event.keyCode] = true;
    });
    window.addEventListener('keyup', (event) => {
      this.pressedKeys[event.keyCode] = false;
    });
  }

  fireBullet(entity) {
    let transform = entity.getComponent(Transform);
    let speed = 500;
    let velocity = {
      x: Math.cos(transform.orientation) * speed,
      y: Math.sin(transform.orientation) * speed
    };
    let bullet = this.world.createEntity()
      .addComponent(Transform, { x: transform.x, y: transform.y })
      .addComponent(Velocity, velocity)
      .addComponent(Damage, { value: 1, immune: [Player] })
      .addComponent(Health, { value: 1 })
      .addComponent(Lifespan, { value: 1 })
      .addComponent(Polygon, { fill: "#FFFF77", stroke: "#FFFF99" })
      .addComponent(Collider, { radius: 1 })
      .addComponent(PlayerBullet);
  }

  execute(delta, time) {
    this.queries.player.results.forEach(entity => {
      const transform = entity.getMutableComponent(Transform);
      const velocity = entity.getMutableComponent(Velocity);

      const direction = { x: 0, y: 0 };

      if (this.pressedKeys['W'.charCodeAt(0)]) {
        direction.y -= 1;
      }
      if (this.pressedKeys['S'.charCodeAt(0)]) {
        direction.y += 1;
      }
      if (this.pressedKeys['A'.charCodeAt(0)]) {
        direction.x -= 1;
      }
      if (this.pressedKeys['D'.charCodeAt(0)]) {
        direction.x += 1;
      }

      if (direction.x || direction.y) {
        velocity.x += direction.x * 100.0 * delta;
        velocity.y += direction.y * 100.0 * delta;

        const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
        if (speed > velocity.maxSpeed) {
          velocity.x *= velocity.maxSpeed / speed;
          velocity.y *= velocity.maxSpeed / speed;
        }

        const targetOrientation = Math.atan2(direction.y, direction.x);
        let orientationDelta = targetOrientation - transform.orientation;
        transform.orientation += ( targetOrientation - transform.orientation ) * 0.1;
      }

      // Fire bullets
      if (this.pressedKeys[' '.charCodeAt(0)]) {
        this.fireBullet(entity);
      }
    });
  }
}