import { fabric } from 'fabric';
import * as pdfjsLib from 'pdfjs-dist';

// 使用相同版本的 worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

export class SignatureTool {
  constructor(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      throw new Error('Canvas element not found');
    }
    
    this.canvas = new fabric.Canvas(canvasId);
    this.history = [];
    this.setupCanvas();
    this.bindEvents();
    
    // 添加签名模式属性
    this.signatureMode = 'handwrite';
    
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  handleResize() {
    const container = document.querySelector('.canvas-container');
    const width = container.clientWidth;
    this.canvas.setWidth(width);
    this.canvas.setHeight(width * 0.5);
    this.canvas.renderAll();
  }

  setupCanvas() {
    const container = document.querySelector('.canvas-container');
    const width = container.clientWidth;
    this.canvas.setWidth(width);
    this.canvas.setHeight(width * 0.5);
    this.canvas.isDrawingMode = true;
    this.canvas.freeDrawingBrush.width = 2;
    this.canvas.freeDrawingBrush.color = '#000';
    this.canvas.backgroundColor = '#fff';
  }

  bindEvents() {
    this.canvas.on('path:created', (e) => {
      this.history.push(e.path);
    });
  }

  clear() {
    this.canvas.clear();
    this.canvas.backgroundColor = '#fff';
    this.history = [];
  }

  undo() {
    if (this.history.length > 0) {
      const lastPath = this.history.pop();
      this.canvas.remove(lastPath);
    }
  }

  setBrushSize(size) {
    this.canvas.freeDrawingBrush.width = parseInt(size, 10);
  }

  setBrushColor(color) {
    this.canvas.freeDrawingBrush.color = color;
  }

  // 添加预览功能
  async loadDocument(file) {
    console.log('开始处理文件:', file.type);
    try {
      if (file.type === 'application/pdf') {
        console.log('检测到PDF文件');
        return this.loadPDF(file);
      } else if (file.type.startsWith('image/')) {
        console.log('检测到图片文件');
        return this.loadImage(file);
      } else {
        throw new Error('不支持的文件类型');
      }
    } catch (error) {
      console.error('文件处理错误:', error);
      throw error;
    }
  }

  async loadPDF(file) {
    try {
      console.log('开始读取PDF文件');
      const arrayBuffer = await file.arrayBuffer();
      console.log('PDF文件读取完成，大小:', arrayBuffer.byteLength);
      
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        verbosity: pdfjsLib.VerbosityLevel.ERRORS
      });
      console.log('PDF加载任务创建成功');
      
      const pdf = await loadingTask.promise;
      console.log('PDF文档加载成功，页数:', pdf.numPages);
      
      const page = await pdf.getPage(1);
      console.log('获取第一页成功');
      
      const scale = 1.5;
      const viewport = page.getViewport({ scale });
      
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      console.log('Canvas创建成功，尺寸:', canvas.width, 'x', canvas.height);
      
      const context = canvas.getContext('2d');
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        enableWebGL: true
      };
      
      console.log('开始渲染PDF页面');
      await page.render(renderContext).promise;
      console.log('PDF渲染完成');
      
      const previewContainer = document.getElementById('previewContainer');
      if (!previewContainer) {
        throw new Error('预览容器不存在');
      }
      previewContainer.innerHTML = '';
      previewContainer.appendChild(canvas);
      console.log('预览更新成功');
      
      this.documentImage = new fabric.Image(canvas);
      console.log('文档图像保存成功');
      
      return Promise.resolve();
    } catch (error) {
      console.error('PDF处理失败:', error);
      throw new Error(`PDF处理失败: ${error.message}`);
    }
  }

  async loadImage(file) {
    console.log('开始处理图片文件');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        console.log('图片文件读取完成');
        fabric.Image.fromURL(e.target.result, (img) => {
          console.log('图片转换成功');
          this.documentImage = img;
          
          const previewContainer = document.getElementById('previewContainer');
          if (!previewContainer) {
            reject(new Error('预览容器不存在'));
            return;
          }
          
          const preview = document.createElement('img');
          preview.src = e.target.result;
          preview.style.maxWidth = '100%';
          previewContainer.innerHTML = '';
          previewContainer.appendChild(preview);
          console.log('预览更新成功');
          
          resolve();
        });
      };
      
      reader.onerror = (error) => {
        console.error('图片读取失败:', error);
        reject(error);
      };
      
      reader.readAsDataURL(file);
    });
  }

  async generateSignedDocument() {
    if (!this.documentImage) {
      throw new Error('请先上传文档');
    }

    return new Promise((resolve, reject) => {
      try {
        const finalCanvas = new fabric.Canvas(null);
        finalCanvas.setWidth(this.documentImage.width);
        finalCanvas.setHeight(this.documentImage.height);
        
        finalCanvas.add(this.documentImage);
        
        if (this.signatureMode === 'text') {
          // 文字签名
          const signatureText = document.getElementById('signatureText').value;
          if (!signatureText) {
            throw new Error('请输入签名文字');
          }

          const fontFamily = document.getElementById('fontFamily').value;
          const fontSize = parseInt(document.getElementById('fontSize').value);
          
          // 创建文字对象
          const text = new fabric.Text(signatureText, {
            left: finalCanvas.width - 300,
            top: finalCanvas.height - 100,
            fontFamily: `${fontFamily}, cursive`,
            fontSize: fontSize,
            fill: document.getElementById('textColor').value,
            charSpacing: 60,
            strokeWidth: 0.3,
            stroke: document.getElementById('textColor').value,
            shadow: new fabric.Shadow({
              color: 'rgba(0,0,0,0.15)',
              blur: 2,
              offsetX: 1,
              offsetY: 1
            })
          });

          // 根据字体类型应用不同的样式
          switch (fontFamily) {
            case 'Homemade Apple':
              text.set({
                angle: -4,
                charSpacing: 120,
                skewX: -8,
                strokeWidth: 0.2
              });
              break;
            case 'Liu Jian Mao Cao':
              text.set({
                angle: -5,
                charSpacing: 30,
                skewX: -10,
                strokeWidth: 0.4
              });
              break;
            case 'Shadows Into Light':
              text.set({
                angle: -3,
                charSpacing: 80,
                skewX: -5,
                strokeWidth: 0.3
              });
              break;
            case 'Kalam':
              text.set({
                angle: -2,
                charSpacing: 70,
                skewX: -4,
                strokeWidth: 0.5
              });
              break;
            case 'Gloria Hallelujah':
              text.set({
                angle: -1,
                charSpacing: 90,
                skewX: -3,
                strokeWidth: 0.4
              });
              break;
            case 'Satisfy':
              text.set({
                angle: -6,
                charSpacing: 100,
                skewX: -7,
                strokeWidth: 0.2
              });
              break;
            default:
              text.set({
                angle: -4,
                charSpacing: 50,
                skewX: -6,
                strokeWidth: 0.3
              });
          }

          // 添加更多随机变化
          text.set({
            angle: text.angle + (Math.random() * 3 - 1.5),  // 更大的角度变化
            skewX: text.skewX + (Math.random() * 4 - 2),    // 更大的倾斜变化
            charSpacing: text.charSpacing + (Math.random() * 20 - 10),  // 更大的间距变化
            top: text.top + (Math.random() * 10 - 5),  // 随机上下位置
            left: text.left + (Math.random() * 10 - 5)  // 随机左右位置
          });

          // 添加笔画不均匀效果
          text.set({
            strokeWidth: text.strokeWidth * (0.8 + Math.random() * 0.4)  // 随机笔画粗细
          });

          finalCanvas.add(text);
          const dataUrl = finalCanvas.toDataURL({format: 'png'});
          resolve(dataUrl);
        } else {
          // 手写签名
          const signatureData = this.canvas.toDataURL();
          fabric.Image.fromURL(signatureData, (signature) => {
            signature.scale(0.5);
            signature.set({
              left: finalCanvas.width - signature.width * 0.5 - 50,
              top: finalCanvas.height - signature.height * 0.5 - 50
            });
            finalCanvas.add(signature);
            const dataUrl = finalCanvas.toDataURL({format: 'png'});
            resolve(dataUrl);
          });
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  // 添加设置签名模式的方法
  setSignatureMode(mode) {
    this.signatureMode = mode;
  }
} 