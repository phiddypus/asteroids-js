//Hello! Welcome to this asteroids remake. the constants below are some of the settings you can tweak. Have fun and feel free to explore the code! Don't be afraid to ask me if you want to understand something in here!



const
    CANVAS_SIZE = Math.min(window.innerHeight, window.innerWidth) - 50,
    DIFFICULTY = 0.3, // number bw 0 and 1

    ASTEROID_SIZE = 80,
    ASTEROID_SPEED = 0.6,

    PLAYER_SIZE = 10,
    PLAYER_FRICTION = 0.99,
    PLAYER_MAX_SPEED = 5,
    PLAYER_ACCEL = PLAYER_MAX_SPEED / 30, // 0.5sec for 0 to top speed
    PLAYER_TURN_SPEED = Math.PI / 45, // 1.5sec for full rotation
    PLAYER_MIN_SHOOT_DELAY = 10, // 6 per sec
    PLAYER_CONTROLS = {
        fwd: 87, // up arrow
        l: 65, // left arrow
        r: 68, // right arrow
        shoot: 32, // spacebar
        tutorial: '[W]\n[A][D]\n[SPACE]'
    },

    BULLET_SIZE = 15,
    BULLET_SPEED = 8;

function setup() {
    createCanvas(CANVAS_SIZE, CANVAS_SIZE);
    frameRate(60);
    textAlign(CENTER, CENTER);
    textFont('Courier New', 20);
}

function angle(p, o, q) {
    const po = p.dist(o);
    const oq = o.dist(q);
    const pq = p.dist(q);

    return Math.acos((po ** 2 + oq ** 2 - pq ** 2) / (2 * po * oq));
}

class Edge {
    constructor(points) {
        this.points = points;
        // if (this.points.length != 2) console.error(this.points.length + " points given to Edge, 2 expected.");
    }

    intersecting(otherEdge) {
        const
            a = this.points[0],
            b = this.points[1],
            c = otherEdge.points[0],
            d = otherEdge.points[1],

            cad = angle(c, a, d),
            cab = angle(c, a, b),
            dab = angle(d, a, b),
            cba = angle(c, b, a),
            dba = angle(d, b, a);

        if (
            cad != Math.max(cad, cab, dab) || // angles on the same side
            (cab + dab) > Math.PI || // first point: convex
            (cba + dba) > Math.PI // second point: convex
        ) return false;

        return true;
    }
}

class Polygon {
    constructor(pos, vel, relPoints, r) {
        this.pos = pos; // {v: p5.Vector(), a: angle}
        this.vel = vel; // {v: p5.Vector(), a: angle}
        this.relPoints = relPoints; // points relative to center, [new p5.Vector(), new p5.Vector()...]
        this.r = r; // farthest distance from center of any of the points
    }

    draw() {
        push();
        translate(this.pos.v.x, this.pos.v.y);
        rotate(this.pos.a);
        beginShape();
        for (const point of this.relPoints) {
            vertex(point.x, point.y);
        }
        endShape(CLOSE);
        pop();
    }

    update() {
        this.pos.v.add(this.vel.v);
        this.pos.a += this.vel.a;
    }

    wraparound() {
        if (this.pos.v.x - this.r > CANVAS_SIZE) this.pos.v.x = - this.r; // right edge
        else if (this.pos.v.x + this.r < 0) this.pos.v.x = CANVAS_SIZE + this.r; // left edge

        if (this.pos.v.y - this.r > CANVAS_SIZE) this.pos.v.y = - this.r; // bottom edge
        else if (this.pos.v.y + this.r < 0) this.pos.v.y = CANVAS_SIZE + this.r; // top edge
    }

    edges() {
        const cosa = Math.cos(this.pos.a);
        const sina = Math.sin(this.pos.a);
        const truePoints = this.relPoints.map(point => new p5.Vector(
            (point.x * cosa - point.y * sina) + this.pos.v.x,
            (point.x * sina + point.y * cosa) + this.pos.v.y
        ));

        let edges = [];
        for (let i = 0; i < truePoints.length; i++) {
            edges[i] = new Edge([truePoints[i], truePoints[(i + 1) % truePoints.length]]);
        }

        return edges;
    }

    colliding(otherPoly) {
        if (this.pos.v.dist(otherPoly.pos.v) > this.r + otherPoly.r) return false;

        for (const edge of this.edges()) {
            for (const otherEdge of otherPoly.edges()) {
                if (edge.intersecting(otherEdge)) return true;
            }
        }

        return false;
    }
}

class Asteroid extends Polygon {
    constructor(x, y, r) {
        let randVel = new p5.Vector(Math.random() + ASTEROID_SPEED - 0.5);
        randVel.setHeading(Math.random() * 2 * Math.PI);

        const sides = Math.round(Math.random() * 4 + 6)

        super(
            {
                v: new p5.Vector(x, y),
                a: 0
            },
            {
                v: randVel,
                a: Math.random() * Math.PI / 50 - Math.PI / 100
            },
            Array.from({ length: sides }, (_, i) => {
                const angle = i * 2 * Math.PI / sides;
                let point = new p5.Vector(r);
                point.setHeading(angle);
                return point;
            }),
            r
        );
    }

    update() {
        super.update();
        super.wraparound();
    }

    break() {
        if (this.r == ASTEROID_SIZE / 4) {
            return Asteroid.spawnAsteroids(1);
        } else {
            return Array.from({ length: 2 }, () => new Asteroid(this.pos.v.x, this.pos.v.y, this.r / 2));
        }
    }

    static spawnAsteroids(n) {
        return Array.from({ length: n }, () => {
            let randPos = new p5.Vector(CANVAS_SIZE);
            randPos.setHeading(Math.random() * 2 * Math.PI);
            randPos.add(CANVAS_SIZE / 2, CANVAS_SIZE / 2);

            return new Asteroid(randPos.x, randPos.y, Math.random() < DIFFICULTY ? ASTEROID_SIZE : ASTEROID_SIZE / 2);
        })
    }
}

class Bullet extends Polygon {
    constructor(x, y, angle) {
        let vel = new p5.Vector(BULLET_SPEED);
        vel.setHeading(angle);

        super(
            {
                v: new p5.Vector(x, y),
                a: angle
            },
            {
                v: vel,
                a: 0
            },
            [
                new p5.Vector(0, 0),
                new p5.Vector(BULLET_SIZE, 0)
            ],
            BULLET_SIZE
        );
    }
}

class Ship extends Polygon {
    constructor(x, y, angle) {
        const calcX = PLAYER_SIZE * Math.cos(Math.PI / 5);
        const calcY = PLAYER_SIZE * Math.sin(Math.PI / 5);

        super(
            {
                v: new p5.Vector(x, y),
                a: angle
            },
            {
                v: new p5.Vector(0, 0),
                a: 0
            },
            [
                new p5.Vector(PLAYER_SIZE, 0),
                new p5.Vector(- calcX, calcY),
                new p5.Vector(- calcX, - calcY)
            ],
            PLAYER_SIZE
        );

        this.shootDelay = PLAYER_MIN_SHOOT_DELAY;
        this.bullets = [];
    }

    accel() {
        let accelVector = new p5.Vector(PLAYER_ACCEL);
        accelVector.setHeading(this.pos.a);
        this.vel.v.add(accelVector);
    }

    rotate(c) {
        this.pos.a += c * PLAYER_TURN_SPEED;
    }

    shoot() {
        let bulletPos = new p5.Vector(this.r);
        bulletPos.setHeading(this.pos.a);
        bulletPos.add(this.pos.v);

        this.bullets.push(new Bullet(bulletPos.x, bulletPos.y, this.pos.a));
    }

    update() {
        super.update();
        this.vel.v.mult(PLAYER_FRICTION);

        this.bullets.forEach((bullet, i) => {
            if (
                bullet.pos.v.x > CANVAS_SIZE ||
                bullet.pos.v.x < 0 ||
                bullet.pos.v.y > CANVAS_SIZE ||
                bullet.pos.v.y < 0
            ) {
                delete this.bullets[i];
            } else {
                bullet.update();
            }
        });

        this.bullets = this.bullets.filter(x => x);
        if (keyIsDown(PLAYER_CONTROLS.fwd)) this.accel();
        if (keyIsDown(PLAYER_CONTROLS.l)) this.rotate(-1);
        if (keyIsDown(PLAYER_CONTROLS.r)) this.rotate(1);
        if (keyIsDown(PLAYER_CONTROLS.shoot) && this.shootDelay == 0) {
            this.shoot();
            this.shootDelay = PLAYER_MIN_SHOOT_DELAY;
        }
        if (this.shootDelay > 0) this.shootDelay--;

        super.wraparound();
        this.vel.v.limit(PLAYER_MAX_SPEED);
    }
}

let asteroids;
let ship;
let score;
let scene;

function reset() {
    asteroids = Asteroid.spawnAsteroids(5);
    ship = new Ship(
        CANVAS_SIZE / 2,
        CANVAS_SIZE / 2,
        - Math.PI / 2,
    );

    score = 0;
    scene = 'play';
}

reset();

let gameOverFLAG = false;

function draw() {
    background(25);
    noFill();
    stroke(255);

    if (scene == 'play') {
        text(PLAYER_CONTROLS.tutorial, CANVAS_SIZE / 2, 50);
        text(`SCORE: ${score}`, CANVAS_SIZE / 2, CANVAS_SIZE - 20)

        //update all
        asteroids = asteroids.filter(x => x);
        asteroids.forEach(asteroid => {
            asteroid.update();
        });

        ship.update();

        //check for ship - asteroid, bullet - asteroid collision
        asteroids.forEach((asteroid, aI) => {
            if (asteroid.colliding(ship)) {
                scene = 'game over';
                gameOverFLAG = true;
                setTimeout(loop, 1000);
                noLoop();
            } else {
                ship.bullets.forEach((bullet, bI) => {
                    if (asteroid.colliding(bullet)) {
                        asteroids = asteroids.concat(asteroid.break());
                        delete ship.bullets[bI];
                        delete asteroids[aI];
                        score++;
                    }
                });
            }
        });

        //draw all
        asteroids.concat(ship, ship.bullets).forEach(sprite => {
            sprite.draw();
        })
    } else if (scene == 'game over') {
        text(`GAME OVER\nSCORE: ${score}`, CANVAS_SIZE / 2, CANVAS_SIZE / 2);

        if (gameOverFLAG) {
            gameOverFLAG = false;
            setTimeout(loop, 1000);
            noLoop();
        } else {
            text('[PRESS ANY KEY TO PLAY AGAIN]', CANVAS_SIZE / 2, 3 * CANVAS_SIZE / 4)
            if (keyIsPressed) {
                reset();
            }
        }
    }
}