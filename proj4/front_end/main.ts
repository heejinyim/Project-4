interface OnclickHandler{
	(x:number, y:number): void ;
}

interface UpdateHandler{
	(): void;
}

interface HttpPostCallback {
	(x:any): any;
}

const random_id = (len:number) => {
    let p = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return [...Array(len)].reduce(a => a + p[Math.floor(Math.random() * p.length)], '');
}

const g_origin = new URL(window.location.href).origin;
const g_id = random_id(12);
const httpPost = (page_name: string, payload: any, callback: HttpPostCallback) => {
	let request = new XMLHttpRequest();
	request.onreadystatechange = () => {
		if(request.readyState === 4)
		{
			if(request.status === 200) {
				let response_obj;
				try {
					response_obj = JSON.parse(request.responseText);
				} catch(err) {}
				if (response_obj) {
					callback(response_obj);
				} else {
					callback({
						status: 'error',
						message: 'response is not valid JSON',
						response: request.responseText,
					});
				}
			} else {
				if(request.status === 0 && request.statusText.length === 0) {
					callback({
						status: 'error',
						message: 'connection failed',
					});
				} else {
					callback({
						status: 'error',
						message: `server returned status ${request.status}: ${request.statusText}`,
					});
				}
			}
		}
	};
	request.open('post', `${g_origin}/${page_name}`, true);
	request.setRequestHeader('Content-Type', 'application/json');
	request.send(JSON.stringify(payload));
}

class Sprite 
{
	x: number;
	y: number;
	speed: number;
	dest_x: number;
	dest_y: number;
	image: HTMLImageElement;
	onclick:OnclickHandler;
	update:UpdateHandler;

	
	constructor(x:number, y:number, image_url:string, update_method:UpdateHandler, onclick_method:OnclickHandler) {
		this.x = x;
		this.y = y;
        this.speed = 4;
		this.image = new Image();
		this.image.src = image_url;
		this.update = update_method;
		this.onclick = onclick_method;
		this.dest_x = this.x;
		this.dest_y = this.y;
	}

	set_destination(x:number, y:number){
		this.dest_x = x;
		this.dest_y = y;
	}	

	ignore_click(x:number, y:number){
	}	

	move(dx:number, dy:number) {
		this.dest_x = this.x + dx;
		this.dest_y = this.y + dy;
	}

	go_toward_destination(){
		if(this.dest_x === undefined)
			return;
		if(this.x < this.dest_x)
			this.x += Math.min(this.dest_x - this.x, this.speed);
		else if(this.x > this.dest_x)
			this.x -= Math.min(this.x - this.dest_x, this.speed);
		if(this.y < this.dest_y)
			this.y += Math.min(this.dest_y - this.y, this.speed);
		else if(this.y > this.dest_y)
			this.y -= Math.min(this.y - this.dest_y, this.speed);
	}	
	sit_still(){
	}
}

let id_to_sprites: Record<string, Sprite> = {};

class Model {
	sprites:Sprite[];
	robot:Sprite;

	constructor() {
		this.sprites = [];
		this.robot = new Sprite(80,150, "blue_robot.png", Sprite.prototype.go_toward_destination, Sprite.prototype.set_destination);
		this.sprites.push(this.robot);
		id_to_sprites[g_id] = this.robot;
	}

	update() {
		for (const sprite of this.sprites) {
			sprite.update();
		}	
	}

	onclick(x:number, y:number) {
		for (const sprite of this.sprites) {
			sprite.onclick(x, y);
		}
	}

	move(dx:number, dy:number) {
		this.robot.move(dx, dy);
	}
}

class View
{
	// turtle:HTMLImageElement;
	model:Model;
	canvas:HTMLCanvasElement;
	
	constructor(model:Model) {
		this.model = model;
		this.canvas = document.getElementById("myCanvas") as unknown as HTMLCanvasElement;
		// this.turtle = new Image();
		// this.turtle.src = "turtle.png";
	}

	update() {
		let ctx = this.canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
		ctx.clearRect(0, 0, 1000, 500);
		for (const sprite of this.model.sprites) {
			ctx.drawImage(sprite.image, sprite.x - sprite.image.width / 2, sprite.y - sprite.image.height);
		}
	}
}

class Controller
{
	key_right: boolean;
	key_left: boolean;
	key_up: boolean;
	key_down: boolean;
	model:Model;
	view:View;
	last_updates_request_time:number;

	constructor(model:Model, view:View) {
		this.model = model;
		this.view = view;
		this.key_right = false;
		this.key_left = false;
		this.key_up = false;
		this.key_down = false;
		let self = this;
		this.last_updates_request_time = 0;
		view.canvas.addEventListener("click", function(event) { self.onClick(event); });
		document.addEventListener('keydown', function(event) { self.keyDown(event); }, false);
		document.addEventListener('keyup', function(event) { self.keyUp(event); }, false);
	}

	onClick(event:MouseEvent) {
		const x = event.pageX - this.view.canvas.offsetLeft;
		const y = event.pageY - this.view.canvas.offsetTop;
		this.model.onclick(x, y);

		httpPost('ajax.html', {
			id: g_id,
			action: 'Click',
			x: x,
			y: y,
		}, this.onAcknowledgeClick);
	}

	keyDown(event:KeyboardEvent) {
		if(event.keyCode == 39) this.key_right = true;
		else if(event.keyCode == 37) this.key_left = true;
		else if(event.keyCode == 38) this.key_up = true;
		else if(event.keyCode == 40) this.key_down = true;	
	}

	keyUp(event:KeyboardEvent) {
		if(event.keyCode == 39) this.key_right = false;
		else if(event.keyCode == 37) this.key_left = false;
		else if(event.keyCode == 38) this.key_up = false;
		else if(event.keyCode == 40) this.key_down = false;
	}

	on_receive_updates(ob: any) {
		console.log(`ob: ${JSON.stringify(ob)}`);
		if(ob === null || ob === undefined) {
			return;
		}

		for (let i = 0; i < ob.updates.length; i++) {
			let up = ob.updates[i];
			let id = up[0];
			let x = up[1];
			let y = up[2];
			let sprite = id_to_sprites[id];
			
			console.log(this.model.sprites);
			console.log(id_to_sprites);

			if(sprite === undefined) {
				sprite = new Sprite(80, 150, "green_robot.png", Sprite.prototype.go_toward_destination, Sprite.prototype.ignore_click)
				this.model.sprites.push(sprite);
				id_to_sprites[id] = sprite;
			}
			sprite.set_destination(x, y);
		}
	}

	request_updates() {
		let payload = {
			id: g_id,
			action: "Update",
		}
		httpPost("ajax.html", payload, (ob) => this.on_receive_updates(ob));
	}

	update() {
		let dx = 0;
		let dy = 0;
        let speed = this.model.robot.speed;
		if(this.key_right) dx += speed;
		if(this.key_left) dx -= speed;
		if(this.key_up) dy -= speed;
		if(this.key_down) dy += speed;
		if(dx != 0 || dy != 0)
			this.model.move(dx, dy);

		const time = Date.now();
		if (time - this.last_updates_request_time >= 1000) {
			this.last_updates_request_time = time;
			this.request_updates();
		}
	}

	onAcknowledgeClick(ob: any) {
		console.log(`Response to move: ${JSON.stringify(ob)}`);
	}
}

class Game {
	model:Model;
	view:View;
	controller:Controller;
	constructor() {
		this.model = new Model();
		this.view = new View(this.model);
		this.controller = new Controller(this.model, this.view);
	}

	onTimer() {
		this.controller.update();
		this.model.update();
		this.view.update();
	}
}

let game = new Game();
let timer = setInterval(() => { game.onTimer(); }, 40);

