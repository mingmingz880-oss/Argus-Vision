import React, { useState, useRef, useEffect } from 'react';
import { Camera, Coordinate, AlarmLevel, Task, Algorithm } from '../types';
import { parseRuleDescription, ParsedRule } from '../services/geminiService';
import {
  Video, MousePointer2, Eraser, CheckCircle2, AlertTriangle,
  BrainCircuit, Loader2, Save, X, Monitor, Cpu, Settings2,
  Minus, Spline, Pentagon, ArrowRight, Undo2
} from 'lucide-react';
import { format } from 'date-fns';

// 绘图模式类型
type DrawMode = 'line' | 'curve' | 'polygon' | 'arrow';

// 绘图元素类型
interface DrawElement {
  id: string;
  type: DrawMode;
  points: Coordinate[];
}

interface TaskWizardProps {
  cameras: Camera[];
  onClose: () => void;
  onSave: (task: Omit<Task, 'id' | 'created_at' | 'status'> & { sample_count: { positive_threshold: number; negative_threshold: number } }) => void;
}

const PRESET_ALGORITHMS: Algorithm[] = [
  { id: 'fire', name: '火焰检测', description: '检测明火及早期烟雾', version: 'v2.1', icon: '🔥', type: 'PRESET' },
  { id: 'helmet', name: '安全帽检测', description: '识别未佩戴安全帽', version: 'v1.4', icon: '⛑️', type: 'PRESET' },
  { id: 'intrusion', name: '区域入侵', description: '检测人员进入禁区', version: 'v3.0', icon: '🏃', type: 'PRESET' },
  { id: 'smoking', name: '吸烟检测', description: '识别吸烟动作', version: 'v1.2', icon: '🚬', type: 'PRESET' },
];

export const TaskWizard: React.FC<TaskWizardProps> = ({ cameras, onClose, onSave }) => {
  // Form State
  const [selectedCameras, setSelectedCameras] = useState<string[]>([]);
  // 绘图元素列表
  const [drawElements, setDrawElements] = useState<DrawElement[]>([]);
  const [currentDrawing, setCurrentDrawing] = useState<Coordinate[]>([]);
  const [drawMode, setDrawMode] = useState<DrawMode>('line');
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);

  const [enableAiCustom, setEnableAiCustom] = useState(false);
  const [selectedAlgoId, setSelectedAlgoId] = useState<string | null>(null);
  const [genAiInput, setGenAiInput] = useState('');
  const [genAiResult, setGenAiResult] = useState<ParsedRule | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [genAiError, setGenAiError] = useState<string | null>(null);

  const [taskName, setTaskName] = useState('');
  const [duration, setDuration] = useState(0);
  const [alarmLevel, setAlarmLevel] = useState<AlarmLevel>(AlarmLevel.HIGH);
  const [positiveThreshold, setPositiveThreshold] = useState(30);
  const [negativeThreshold, setNegativeThreshold] = useState(30);

  // ROI Canvas Refs
  const canvasRef = useRef<HTMLDivElement>(null);

  // Auto-generate name when algorithm changes
  useEffect(() => {
    if (!taskName) {
      let baseName = '';
      if (selectedAlgoId) {
        baseName = PRESET_ALGORITHMS.find(a => a.id === selectedAlgoId)?.name || '';
      }
      if (enableAiCustom && genAiResult?.action_description) {
        baseName = baseName + ' + ' + genAiResult.object_name;
      }

      if (baseName) {
        setTaskName(`${baseName}_${format(new Date(), 'MMdd')}`);
      }
    }
  }, [selectedAlgoId, enableAiCustom, genAiResult, taskName]);

  // -- Logic: ROI --
  const handleCameraSelect = (id: string) => {
    const newSelection = selectedCameras.includes(id)
      ? selectedCameras.filter(c => c !== id)
      : [...selectedCameras, id];

    setSelectedCameras(newSelection);

    // Logic for auto-switching preview:
    // 1. If we just selected a camera and it's the only one, or no active camera, switch to it.
    // 2. If we unselected the ACTIVE camera, switch to the first available selected camera.
    if (!selectedCameras.includes(id)) {
      // Adding a camera: Switch to it immediately for better feedback
      setActiveCameraId(id);
      // NOTE: We do NOT clear ROI here, assuming user wants to apply the same ROI rule to multiple cameras
    } else {
      // Removing a camera
      if (activeCameraId === id) {
        const remaining = newSelection.filter(c => c !== id);
        const next = remaining.length > 0 ? remaining[0] : null;
        setActiveCameraId(next);
        // NOTE: ROI persists
      }
    }
  };

  // 获取归一化坐标
  const getCanvasCoords = (e: React.MouseEvent): Coordinate | null => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height
    };
  };

  // 鼠标按下开始绘制
  const handleMouseDown = (e: React.MouseEvent) => {
    const coord = getCanvasCoords(e);
    if (!coord) return;
    setIsDrawing(true);
    setCurrentDrawing([coord]);
  };

  // 鼠标移动继续绘制
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const coord = getCanvasCoords(e);
    if (!coord) return;

    if (drawMode === 'line' || drawMode === 'arrow') {
      // 直线/箭头只需要起点和终点
      setCurrentDrawing(prev => [prev[0], coord]);
    } else {
      // 曲线/不规则图形记录所有点
      setCurrentDrawing(prev => [...prev, coord]);
    }
  };

  // 鼠标释放完成绘制
  const handleMouseUp = () => {
    if (!isDrawing || currentDrawing.length < 2) {
      setIsDrawing(false);
      setCurrentDrawing([]);
      return;
    }

    const newElement: DrawElement = {
      id: `draw_${Date.now()}`,
      type: drawMode,
      points: currentDrawing
    };

    setDrawElements(prev => [...prev, newElement]);
    setIsDrawing(false);
    setCurrentDrawing([]);
  };

  // 撤销最后一个元素
  const handleUndo = () => {
    setDrawElements(prev => prev.slice(0, -1));
  };

  // 清除所有绘制
  const handleClearAll = () => {
    setDrawElements([]);
    setCurrentDrawing([]);
  };

  // 渲染单个绘图元素
  const renderElement = (element: DrawElement, isPreview = false) => {
    const { type, points, id } = element;
    if (points.length < 2) return null;

    const color = isPreview ? '#fbbf24' : '#007aff';
    const opacity = isPreview ? 0.6 : 0.8;

    if (type === 'line') {
      return (
        <line
          key={id}
          x1={points[0].x * 100}
          y1={points[0].y * 100}
          x2={points[points.length - 1].x * 100}
          y2={points[points.length - 1].y * 100}
          stroke={color}
          strokeWidth="0.5"
          strokeLinecap="round"
          opacity={opacity}
        />
      );
    }

    if (type === 'arrow') {
      const start = points[0];
      const end = points[points.length - 1];
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const arrowLen = 2; // viewBox 坐标下的箭头长度

      const arrow1 = {
        x: end.x * 100 - arrowLen * Math.cos(angle - Math.PI / 6),
        y: end.y * 100 - arrowLen * Math.sin(angle - Math.PI / 6)
      };
      const arrow2 = {
        x: end.x * 100 - arrowLen * Math.cos(angle + Math.PI / 6),
        y: end.y * 100 - arrowLen * Math.sin(angle + Math.PI / 6)
      };

      return (
        <g key={id} opacity={opacity}>
          <line
            x1={start.x * 100}
            y1={start.y * 100}
            x2={end.x * 100}
            y2={end.y * 100}
            stroke={color}
            strokeWidth="0.5"
            strokeLinecap="round"
          />
          <polygon
            points={`${end.x * 100},${end.y * 100} ${arrow1.x},${arrow1.y} ${arrow2.x},${arrow2.y}`}
            fill={color}
          />
        </g>
      );
    }

    if (type === 'curve' || type === 'polygon') {
      // 简化点集（每3个点取一个）
      const simplified = points.filter((_, i) => i % 2 === 0 || i === points.length - 1);
      const pathData = simplified.map((p, i) =>
        `${i === 0 ? 'M' : 'L'} ${p.x * 100} ${p.y * 100}`
      ).join(' ');

      if (type === 'polygon') {
        // 不规则图形闭合
        return (
          <path
            key={id}
            d={pathData + ' Z'}
            fill={`${color}33`}
            stroke={color}
            strokeWidth="0.4"
            opacity={opacity}
          />
        );
      } else {
        // 曲线不闭合
        return (
          <path
            key={id}
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={opacity}
          />
        );
      }
    }

    return null;
  };

  // 渲染所有绘图元素
  const renderDrawings = () => {
    return (
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {drawElements.map(el => renderElement(el))}
        {currentDrawing.length >= 2 && renderElement({ id: 'preview', type: drawMode, points: currentDrawing }, true)}
      </svg>
    );
  };

  // -- Logic: AI --
  const handleParse = async () => {
    if (!genAiInput.trim()) return;
    setIsParsing(true);
    setGenAiError(null);
    setGenAiResult(null);

    try {
      const result = await parseRuleDescription(genAiInput);
      if (result.valid) {
        setGenAiResult(result);
        // Auto-fill config
        if (result.suggested_duration !== undefined) setDuration(result.suggested_duration);
        if (result.suggested_level) setAlarmLevel(result.suggested_level as AlarmLevel);
      } else {
        setGenAiError(result.reason || "语义模糊，请重新描述");
      }
    } catch (err) {
      setGenAiError("API 请求失败，请检查网络");
    } finally {
      setIsParsing(false);
    }
  };

  // -- Logic: Finish --
  const handleFinish = () => {
    // 1. Validate Camera
    if (selectedCameras.length === 0) {
      alert("请至少选择一个视频源");
      return;
    }

    // 2. Validate Algo - 预置算法必选
    if (!selectedAlgoId) {
      alert("请选择一个预置算法");
      return;
    }
    // 3. Validate AI customization if enabled
    if (enableAiCustom && !genAiInput.trim()) {
      alert("已启用AI定制，请输入定制描述");
      return;
    }

    // 3. Validate Name
    if (!taskName.trim()) {
      alert("请输入任务名称");
      return;
    }

    // 4. Validate ROI Warning
    if (drawElements.length === 0) {
      if (!window.confirm("未绘制检测区域，系统将默认检测全屏画面，是否继续？")) return;
    }

    // 始终使用预置算法作为基础
    const finalAlgo: Algorithm = PRESET_ALGORITHMS.find(a => a.id === selectedAlgoId)!;

    // 将绘图元素转换为 ROI 点
    const allPoints = drawElements.flatMap(el => el.points);

    onSave({
      name: taskName,
      camera_ids: selectedCameras,
      roi: allPoints,
      algorithm: finalAlgo,
      // 如果启用了AI定制，附加NLP描述
      nlp_text: enableAiCustom && genAiInput.trim() ? genAiInput : undefined,
      duration,
      alarm_level: alarmLevel,
      sample_count: {
        total: 0,
        labeled: 0,
        positive_threshold: positiveThreshold,
        negative_threshold: negativeThreshold,
      },
    });
  };

  const activeCameraObj = cameras.find(c => c.id === activeCameraId);
  const selectedCameraObjects = cameras.filter(c => selectedCameras.includes(c.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-[95vw] h-[92vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">

        {/* Top Header */}
        <div className="px-6 py-3 border-b flex justify-between items-center bg-gray-50 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-800 flex items-center">
            <Settings2 className="mr-2 text-blue-600" size={20} /> 新建智能分析任务
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-1 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Main Body - Split Layout */}
        <div className="flex-1 flex overflow-hidden">

          {/* LEFT PANEL: CONFIGURATION */}
          <div className="w-[420px] flex-shrink-0 bg-white border-r flex flex-col overflow-y-auto">
            <div className="p-6 space-y-8">

              {/* Section 1: Devices */}
              <section>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center justify-between">
                  <div className="flex items-center"><Monitor size={16} className="mr-2" /> 1. 视频源选择</div>
                  <span className="text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    已选 {selectedCameras.length}
                  </span>
                </h3>
                <div className="bg-gray-50 rounded-lg border p-2 max-h-48 overflow-y-auto space-y-1">
                  {cameras.map(cam => (
                    <div
                      key={cam.id}
                      className={`flex items-center p-2 rounded cursor-pointer transition-colors ${activeCameraId === cam.id ? 'bg-blue-100 border border-blue-200' : 'hover:bg-gray-200 border border-transparent'
                        }`}
                      onClick={() => setActiveCameraId(cam.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCameras.includes(cam.id)}
                        onChange={(e) => { e.stopPropagation(); handleCameraSelect(cam.id); }}
                        className="w-4 h-4 text-blue-600 rounded mr-3 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-700 truncate">{cam.name}</div>
                        <div className="text-xs text-gray-500">{cam.location}</div>
                      </div>
                      {activeCameraId === cam.id && <div className="text-[10px] bg-blue-600 text-white px-1.5 rounded">预览中</div>}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">勾选多个设备可应用同一检测区域。</p>
              </section>

              <hr className="border-gray-100" />

              {/* Section 2: Rules */}
              <section>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center">
                  <Cpu size={16} className="mr-2" /> 2. 规则定义
                </h3>

                {/* 预置算法 - 必选 */}
                <div className="mb-4">
                  <div className="text-xs text-gray-500 mb-2">选择预置算法（必选）</div>
                  <div className="grid grid-cols-2 gap-3">
                    {PRESET_ALGORITHMS.map(algo => (
                      <div
                        key={algo.id}
                        onClick={() => setSelectedAlgoId(algo.id)}
                        className={`border rounded-lg p-3 cursor-pointer transition-all hover:shadow-sm ${selectedAlgoId === algo.id ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 bg-white'}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-2xl">{algo.icon}</span>
                          {selectedAlgoId === algo.id && <CheckCircle2 size={16} className="text-blue-600" />}
                        </div>
                        <div className="text-sm font-bold text-gray-800">{algo.name}</div>
                        <div className="text-xs text-gray-500 line-clamp-1">{algo.description}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI 定制增强 - 可选 */}
                <div className={`border rounded-lg p-4 transition-all ${enableAiCustom ? 'border-purple-300 bg-purple-50/30' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <BrainCircuit size={16} className={`mr-2 ${enableAiCustom ? 'text-purple-600' : 'text-gray-400'}`} />
                      <span className={`text-sm font-medium ${enableAiCustom ? 'text-purple-700' : 'text-gray-600'}`}>AI 定制增强</span>
                      <span className="text-xs text-gray-400 ml-2">（可选）</span>
                    </div>
                    <button
                      onClick={() => {
                        if (!selectedAlgoId) {
                          alert('请先选择预置算法');
                          return;
                        }
                        setEnableAiCustom(!enableAiCustom);
                      }}
                      className={`relative w-11 h-6 rounded-full transition-colors ${enableAiCustom ? 'bg-purple-600' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enableAiCustom ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {enableAiCustom && (
                    <div>
                      <textarea
                        className="w-full h-20 p-3 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 resize-none bg-white"
                        placeholder="在预置算法基础上，描述额外的检测要求..."
                        value={genAiInput}
                        onChange={(e) => setGenAiInput(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </section>

              <hr className="border-gray-100" />

              {/* Section 3: Params */}
              <section>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center">
                  <Settings2 size={16} className="mr-2" /> 3. 策略配置
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">任务名称</label>
                    <input
                      type="text"
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value)}
                      maxLength={50}
                      className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="自动生成或手动输入"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">触发时长 (秒)</label>
                      <input
                        type="number"
                        value={duration}
                        onChange={(e) => setDuration(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">告警等级</label>
                      <div className="flex space-x-1">
                        {[AlarmLevel.HIGH, AlarmLevel.MEDIUM, AlarmLevel.LOW].map(lvl => (
                          <button
                            key={lvl}
                            onClick={() => setAlarmLevel(lvl)}
                            className={`flex-1 text-[10px] font-bold py-1.5 rounded border transition-all ${alarmLevel === lvl
                              ? (lvl === 'HIGH' ? 'bg-red-100 text-red-700 border-red-300' : lvl === 'MEDIUM' ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-yellow-100 text-yellow-700 border-yellow-300')
                              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                              }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 调优阈值设置 */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
                    <label className="block text-xs font-medium text-gray-600 mb-2">调优阈值设置</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          <span className="text-green-600">正样本</span> 阈值
                        </label>
                        <input
                          type="number"
                          value={positiveThreshold}
                          onChange={(e) => setPositiveThreshold(Math.max(1, parseInt(e.target.value) || 30))}
                          min={1}
                          className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          <span className="text-red-500">负样本</span> 阈值
                        </label>
                        <input
                          type="number"
                          value={negativeThreshold}
                          onChange={(e) => setNegativeThreshold(Math.max(1, parseInt(e.target.value) || 30))}
                          min={1}
                          className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">模型调优需要达到此阈值的正/负样本数</p>
                  </div>
                </div>
              </section>

            </div>
          </div>

          {/* RIGHT PANEL: CANVAS */}
          <div className="flex-1 bg-gray-900 flex flex-col relative overflow-hidden">
            {/* Preview Switcher Tabs (If multiple selected) */}
            {selectedCameraObjects.length > 0 && (
              <div className="absolute top-4 left-4 right-4 z-20 flex justify-center pointer-events-none">
                <div className="flex space-x-1 bg-black/40 backdrop-blur p-1 rounded-lg pointer-events-auto overflow-x-auto max-w-[600px] scrollbar-hide">
                  {selectedCameraObjects.map(cam => (
                    <button
                      key={cam.id}
                      onClick={() => setActiveCameraId(cam.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all ${activeCameraId === cam.id
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-gray-300 hover:bg-white/10 hover:text-white'
                        }`}
                    >
                      {cam.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 绘图工具栏 */}
            <div className="absolute top-4 right-4 z-20 flex items-center space-x-2">
              {/* 绘图模式选择 */}
              <div className="bg-black/70 backdrop-blur rounded-lg p-1 flex space-x-1">
                <button
                  onClick={() => setDrawMode('line')}
                  className={`px-2 py-1.5 rounded text-xs font-medium flex items-center transition-all ${drawMode === 'line' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-white/10'}`}
                  title="直线"
                >
                  <Minus size={14} className="mr-1" />直线
                </button>
                <button
                  onClick={() => setDrawMode('curve')}
                  className={`px-2 py-1.5 rounded text-xs font-medium flex items-center transition-all ${drawMode === 'curve' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-white/10'}`}
                  title="曲线"
                >
                  <Spline size={14} className="mr-1" />曲线
                </button>
                <button
                  onClick={() => setDrawMode('polygon')}
                  className={`px-2 py-1.5 rounded text-xs font-medium flex items-center transition-all ${drawMode === 'polygon' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-white/10'}`}
                  title="不规则图形"
                >
                  <Pentagon size={14} className="mr-1" />区域
                </button>
                <button
                  onClick={() => setDrawMode('arrow')}
                  className={`px-2 py-1.5 rounded text-xs font-medium flex items-center transition-all ${drawMode === 'arrow' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-white/10'}`}
                  title="箭头"
                >
                  <ArrowRight size={14} className="mr-1" />箭头
                </button>
              </div>

              {/* 状态显示 */}
              <div className="bg-black/60 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full flex items-center shadow-lg border border-white/10">
                <MousePointer2 size={12} className="mr-2" />
                {drawElements.length > 0 ? `已绘 ${drawElements.length} 个元素` : '拖动绘制'}
              </div>

              {/* 撤销/清除 */}
              <button
                onClick={handleUndo}
                disabled={drawElements.length === 0}
                className="bg-white/90 text-gray-600 px-2 py-1.5 rounded-lg shadow text-xs font-medium flex items-center hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Undo2 size={14} className="mr-1" />撤销
              </button>
              <button
                onClick={handleClearAll}
                className="bg-white text-red-600 px-3 py-1.5 rounded-lg shadow-lg text-sm font-medium flex items-center hover:bg-red-50 transition-colors"
              >
                <Eraser size={14} className="mr-1.5" />清除
              </button>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 p-8 flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pt-16">
              {activeCameraObj ? (
                <div className="relative w-full h-full max-w-5xl max-h-[80vh] aspect-video bg-black rounded shadow-2xl overflow-hidden ring-1 ring-white/20">
                  <div
                    ref={canvasRef}
                    className="relative w-full h-full cursor-crosshair group select-none"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    <img
                      src={activeCameraObj.thumbnail}
                      alt="Feed"
                      className="w-full h-full object-cover opacity-90 transition-opacity group-hover:opacity-100 pointer-events-none"
                      draggable={false}
                    />
                    {/* Grid Overlay for precision feel */}
                    <div className="absolute inset-0 pointer-events-none opacity-10"
                      style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
                    </div>

                    {renderDrawings()}

                    {/* Hint */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-xs bg-black/40 px-3 py-1 rounded backdrop-blur pointer-events-none">
                      {activeCameraObj.name} - 拖动绘制{drawMode === 'line' ? '直线' : drawMode === 'curve' ? '曲线' : drawMode === 'polygon' ? '区域' : '箭头'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 flex flex-col items-center">
                  <Video size={64} className="mb-4 opacity-20 text-white" />
                  <p className="text-gray-400">请在左侧列表选择一个摄像头以开始绘图</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-white flex justify-end space-x-3 flex-shrink-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleFinish}
            className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-lg shadow-blue-500/30 flex items-center transition-all hover:scale-[1.02] active:scale-95"
          >
            <Save size={18} className="mr-2" />
            完成创建
          </button>
        </div>
      </div>
    </div>
  );
};