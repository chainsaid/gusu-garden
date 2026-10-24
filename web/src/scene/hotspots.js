import * as THREE from 'three';

// 5 处江南文人园林核心文化景观点
export const HOTSPOT_DATA = [
  {
    id: 'hall',
    title: '水榭主殿 · 歇山晨曦',
    badge: '重檐水榭',
    desc: '江南文人园林典型水榭建筑，采用苏式传统「嫩戗发戗」起翘营造，四面设步步锦长窗。立柱涂以栗壳色桐油大漆，四水环绕，是全园文人雅集与观景主核心。',
    position: new THREE.Vector3(10.0, 4.2, -6.5),
    lookTarget: new THREE.Vector3(10.0, 4.8, -16.0),
    cameraPos: new THREE.Vector3(10.0, 3.8, 8.0),
  },
  {
    id: 'bridge',
    title: '小飞虹 · 青石拱桥',
    badge: '卧波飞虹',
    desc: '单孔青石拱桥跨越碧波荷塘，连接主殿与回廊。桥身曲线柔美，倒映入池，取「卧波千重、飞虹横水」之意，是园中移步换景与高低动线的咽喉枢纽。',
    position: new THREE.Vector3(10.0, 2.2, 17.5),
    lookTarget: new THREE.Vector3(10.0, 1.8, 17.5),
    cameraPos: new THREE.Vector3(20.0, 3.2, 14.0),
  },
  {
    id: 'pagoda',
    title: '远借 · 北宋报恩寺塔',
    badge: '旷世借景',
    desc: '苏州古典园林精湛的「借景」手法。利用荷花池与开阔庭院，将西北方数里外的北寺塔万斤建炎铁刹纳入园内构图，打破院墙界限，纳千里于方寸之间。',
    position: new THREE.Vector3(-24.0, 10.0, -20.0),
    lookTarget: new THREE.Vector3(-105.0, 38.0, -48.0),
    cameraPos: new THREE.Vector3(26.0, 3.2, 24.0),
  },
  {
    id: 'eaves',
    title: '营造 · 嫩戗发戗飞檐',
    badge: '苏式非遗',
    desc: '江南特有的木作起翘工艺。与北方沉稳厚重的庑殿不同，嫩戗斜搭出挑使翼角急遽向上扬起近45度，如展翅飞鸟，雨落如瀑飞溅，空灵飘逸。',
    position: new THREE.Vector3(0.5, 7.8, -17.5),
    lookTarget: new THREE.Vector3(3.0, 8.5, -18.5),
    cameraPos: new THREE.Vector3(-10.0, 7.0, -5.0),
  },
  {
    id: 'rockery',
    title: '品石 · 太湖奇峰',
    badge: '透漏瘦皱',
    desc: '庭前太湖石经太湖水波千万年溶蚀冲刷而成，兼具「透、漏、瘦、皱」四绝。石如云烟翻涌，映衬在粉墙修竹之前，宛若一幅立体的明代水墨画。',
    position: new THREE.Vector3(17.5, 2.2, 1.0),
    lookTarget: new THREE.Vector3(17.5, 2.2, 1.0),
    cameraPos: new THREE.Vector3(14.0, 2.6, 6.0),
  },
];

export class HotspotManager {
  constructor(scene, camera, domContainer, onFocusPOI) {
    this.scene = scene;
    this.camera = camera;
    this.domContainer = domContainer;
    this.onFocusPOI = onFocusPOI;
    this.hotspots = [];
    this.activeHotspot = null;

    this._createDOMContainer();
    this._initMarkers();
  }

  _createDOMContainer() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'hotspots-overlay';
    this.domContainer.appendChild(this.overlay);

    // 弹窗卡片
    this.modal = document.createElement('div');
    this.modal.className = 'poi-modal-backdrop hidden';
    this.modal.innerHTML = `
      <div class="poi-card">
        <button class="poi-close" id="poi-close-btn">&times;</button>
        <div class="poi-badge" id="poi-badge">景致</div>
        <div class="poi-title" id="poi-title">景致名称</div>
        <div class="poi-divider"></div>
        <div class="poi-desc" id="poi-desc">景致文化背景介绍</div>
        <div class="poi-footer">
          <button class="poi-focus-btn" id="poi-focus-btn">飞跃特写视界</button>
        </div>
      </div>
    `;
    this.domContainer.appendChild(this.modal);

    this.modal.querySelector('#poi-close-btn').addEventListener('click', () => {
      this.closeModal();
    });

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.closeModal();
    });

    this.modal.querySelector('#poi-focus-btn').addEventListener('click', () => {
      if (this.activeHotspot && this.onFocusPOI) {
        this.onFocusPOI(this.activeHotspot);
        this.closeModal();
      }
    });
  }

  _initMarkers() {
    HOTSPOT_DATA.forEach((data) => {
      const el = document.createElement('div');
      el.className = 'hotspot-pin';
      el.innerHTML = `
        <div class="pin-ring"></div>
        <div class="pin-dot"></div>
        <div class="pin-label">${data.badge}</div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openModal(data);
      });

      this.overlay.appendChild(el);
      this.hotspots.push({ data, el });
    });
  }

  openModal(data) {
    this.activeHotspot = data;
    this.modal.querySelector('#poi-badge').textContent = data.badge;
    this.modal.querySelector('#poi-title').textContent = data.title;
    this.modal.querySelector('#poi-desc').textContent = data.desc;
    this.modal.classList.remove('hidden');
  }

  closeModal() {
    this.activeHotspot = null;
    this.modal.classList.add('hidden');
  }

  update() {
    const widthHalf = window.innerWidth / 2;
    const heightHalf = window.innerHeight / 2;
    const tempV = new THREE.Vector3();

    this.hotspots.forEach(({ data, el }) => {
      tempV.copy(data.position);
      tempV.project(this.camera);

      // 判断是否在相机前方 (z < 1)
      const isVisible = tempV.z < 1.0;
      if (!isVisible) {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        return;
      }

      // 计算距离衰减
      const dist = this.camera.position.distanceTo(data.position);
      if (dist > 110) {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        return;
      }

      const opacity = Math.min(1.0, Math.max(0.2, (100 - dist) / 40));
      const x = (tempV.x * widthHalf) + widthHalf;
      const y = -(tempV.y * heightHalf) + heightHalf;

      el.style.opacity = opacity.toFixed(2);
      el.style.pointerEvents = 'auto';
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });
  }
}

