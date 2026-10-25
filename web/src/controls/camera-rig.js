import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { L } from '../../../shared/layout.js';

// 5 组文人造园经典航点预设 (以 Node 版 L 布局基准派生)
export const VIEWPOINTS = [
  {
    name: '水榭晨曦',
    desc: '主殿正面全景与双层歇山飞檐',
    pos: new THREE.Vector3(L.hall.center[0], 4.0, 14.0),
    target: new THREE.Vector3(L.hall.center[0], 5.0, L.hall.center[2] + 4.0),
  },
  {
    name: '小飞虹拱桥',
    desc: '经典电影镜头：卧波飞虹借景北寺塔',
    pos: new THREE.Vector3(18.8, 0.45, 23.4),
    target: new THREE.Vector3(5.5, 3.6, 7.5),
  },
  {
    name: '隔池借景北寺塔',
    desc: '隔水远眺北宋万斤建炎铁刹',
    pos: new THREE.Vector3(26.0, 3.2, 24.0),
    target: new THREE.Vector3(L.pagoda.center[0], L.pagoda.totalHeight * 0.5, L.pagoda.center[2]),
  },
  {
    name: '飞檐起翘',
    desc: '特写嫩戗发戗与小青瓦阴阳瓦层叠',
    pos: new THREE.Vector3(-14.0, 8.0, -2.0),
    target: new THREE.Vector3(5.0, 9.5, -20.0),
  },
  {
    name: '全景俯瞰',
    desc: '高台俯瞰粉墙黛瓦与曲折水系',
    pos: new THREE.Vector3(55.0, 28.0, 48.0),
    target: new THREE.Vector3(-10.0, 2.0, -10.0),
  },
];

export class CameraRig {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.controls = new OrbitControls(this.camera, domElement);
    
    // 漫游惯性与阻尼 (保证操作丝滑如丝)
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    
    // 漫游角度与距离限制 (支持北寺塔等百米级借景远眺)
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.minDistance = 1.0;
    this.controls.maxDistance = 1200.0;

    // 交互模式: 'orbit' (导览旋转) | 'walk' (沉浸漫步)
    this.mode = 'orbit';

    // 飞跃运镜插值状态
    this.isTransitioning = false;
    this._transStart = 0;
    this._transDuration = 1800; // 毫秒
    this._fromPos = new THREE.Vector3();
    this._toPos = new THREE.Vector3();
    this._fromTarget = new THREE.Vector3();
    this._toTarget = new THREE.Vector3();

    // 漫步模式状态 (第一人称/游廊漫步)
    this.walkSpeed = 4.5; // 米/秒
    this.walkVelocity = new THREE.Vector3();
    this.keys = { forward: false, backward: false, left: false, right: false };
    this.yaw = 0;
    this.pitch = 0;
    this.isMouseDown = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    // 默认指向第一个经典景点
    this.camera.position.copy(VIEWPOINTS[0].pos);
    this.controls.target.copy(VIEWPOINTS[0].target);
    this.controls.update();

    this._bindWalkEvents();
  }

  // 移步换景：平滑平飞过渡至预设景点
  flyTo(index, duration = 1800) {
    const vp = VIEWPOINTS[index];
    if (!vp) return;
    this.flyToTarget(vp.pos, vp.target, duration);
  }

  // 飞跃运镜过渡到任意坐标与朝向
  flyToTarget(pos, target, duration = 1800) {
    this.isTransitioning = true;
    this._transStart = performance.now();
    this._transDuration = duration;

    this._fromPos.copy(this.camera.position);
    this._toPos.copy(pos);

    this._fromTarget.copy(this.controls.target);
    this._toTarget.copy(target);

    this.controls.enabled = false;
  }

  // 切换漫游模式 ('orbit' | 'walk')
  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    if (mode === 'orbit') {
      this.controls.enabled = true;
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      this.controls.target.copy(this.camera.position).addScaledVector(forward, 10);
      this.controls.update();
    } else {
      this.controls.enabled = false;
      // 切换至站立人眼高度 (2.2m)
      this.camera.position.y = 2.4;
      const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
      this.yaw = euler.y;
      this.pitch = euler.x;
    }
  }

  _bindWalkEvents() {
    window.addEventListener('keydown', (e) => {
      if (this.mode !== 'walk') return;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.forward = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.backward = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = true;
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.forward = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.backward = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = false;
    });

    // 漫步模式下的鼠标拖拽视角控制
    this.domElement.addEventListener('mousedown', (e) => {
      if (this.mode !== 'walk') return;
      this.isMouseDown = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.mode !== 'walk' || !this.isMouseDown) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;

      const sensitivity = 0.0035;
      this.yaw -= dx * sensitivity;
      this.pitch -= dy * sensitivity;
      this.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.pitch));
    });

    // 移动端触摸拖拽旋转
    this.domElement.addEventListener('touchstart', (e) => {
      if (this.mode !== 'walk' || e.touches.length !== 1) return;
      this.isMouseDown = true;
      this.lastMouseX = e.touches[0].clientX;
      this.lastMouseY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchend', () => {
      this.isMouseDown = false;
    });

    window.addEventListener('touchmove', (e) => {
      if (this.mode !== 'walk' || !this.isMouseDown || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - this.lastMouseX;
      const dy = e.touches[0].clientY - this.lastMouseY;
      this.lastMouseX = e.touches[0].clientX;
      this.lastMouseY = e.touches[0].clientY;

      const sensitivity = 0.004;
      this.yaw -= dx * sensitivity;
      this.pitch -= dy * sensitivity;
      this.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.pitch));
    }, { passive: true });
  }

  update(delta = 0.016) {
    if (this.isTransitioning) {
      const now = performance.now();
      const elapsed = now - this._transStart;
      const progress = Math.min(1.0, elapsed / this._transDuration);

      // 三次贝塞尔缓动 (Smooth step ease-in-out)
      const ease = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.camera.position.lerpVectors(this._fromPos, this._toPos, ease);
      this.controls.target.lerpVectors(this._fromTarget, this._toTarget, ease);

      if (progress >= 1.0) {
        this.isTransitioning = false;
        if (this.mode === 'orbit') {
          this.controls.enabled = true;
        }
      }
      return;
    }

    if (this.mode === 'orbit') {
      if (this.controls.enabled) this.controls.update();
    } else if (this.mode === 'walk') {
      // 1. 根据当前 yaw/pitch 更新相机旋转
      const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
      this.camera.quaternion.copy(qYaw).multiply(qPitch);

      // 2. 计算水平移动方向
      const moveDir = new THREE.Vector3();
      if (this.keys.forward) moveDir.z -= 1;
      if (this.keys.backward) moveDir.z += 1;
      if (this.keys.left) moveDir.x -= 1;
      if (this.keys.right) moveDir.x += 1;

      if (moveDir.lengthSq() > 0) {
        moveDir.normalize();
        moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
        this.walkVelocity.lerp(moveDir.multiplyScalar(this.walkSpeed), 0.12);
      } else {
        this.walkVelocity.lerp(new THREE.Vector3(0, 0, 0), 0.15);
      }

      this.camera.position.addScaledVector(this.walkVelocity, delta);

      // 3. 园林物理漫步边界与台基高度约束
      // 庭院活动范围: x in [-22, 38], z in [-20, 36]
      this.camera.position.x = Math.max(-22, Math.min(38, this.camera.position.x));
      this.camera.position.z = Math.max(-20, Math.min(36, this.camera.position.z));

      // 若在主厅台基区域 (x in [0, 20], z in [-18, 0])，地面高程抬升至 y=2.8m，人眼高度=4.4m
      const inHallPodium = this.camera.position.x >= 0 && this.camera.position.x <= 20 &&
                           this.camera.position.z >= -18 && this.camera.position.z <= 0;
      const targetEyeY = inHallPodium ? 4.2 : 2.4;
      this.camera.position.y += (targetEyeY - this.camera.position.y) * 0.08;
    }
  }
}

