import React, { useState, useRef, useEffect } from 'react';
import { Camera, Coordinate, AlarmLevel, Task, Algorithm } from '../types';
import { parseRuleDescription, ParsedRule } from '../services/geminiService';
import { 
  Video, MousePointer2, Eraser, CheckCircle2, AlertTriangle, 
  BrainCircuit, Loader2, Save, X, Monitor, Cpu, Settings2
} from 'lucide-react';
import { format } from 'date-fns';

interface TaskWizardProps {
  cameras: Camera[];
  onClose: () => void;
  onSave: (task: Omit<Task, 'id' | 'created_at' | 'status' | 'sample_count'>) => void;
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
  const [roiPoints, setRoiPoints] = useState<Coordinate[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  
  const [algoMode, setAlgoMode] = useState<'PRESET' | 'GENAI'>('PRESET');
  const [selectedAlgoId, setSelectedAlgoId] = useState<string | null>(null);
  const [genAiInput, setGenAiInput] = useState('');
  const [genAiResult, setGenAiResult] = useState<ParsedRule | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [genAiError, setGenAiError] = useState<string | null>(null);

  const [taskName, setTaskName] = useState('');
  const [duration, setDuration] = useState(0);
  const [alarmLevel, setAlarmLevel] = useState<AlarmLevel>(AlarmLevel.HIGH);

  // ROI Canvas Refs
  const canvasRef = useRef<HTMLDivElement>(null);

  // Auto-generate name when algorithm changes
  useEffect(() => {
    if (!taskName) {
      let baseName = '';
      if (algoMode === 'PRESET' && selectedAlgoId) {
        baseName = PRESET_ALGORITHMS.find(a => a.id === selectedAlgoId)?.name || '';
      } else if (algoMode === 'GENAI' && genAiResult?.action_description) {
        baseName = genAiResult.object_name + '检测';
      }
      
      if (baseName) {
        setTaskName(`${baseName}_${format(new Date(), 'MMdd')}`);
      }
    }
  }, [algoMode, selectedAlgoId, genAiResult, taskName]);

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

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setRoiPoints(prev => [...prev, { x, y }]);
  };

  const renderROI = () => {
    if (roiPoints.length === 0) return null;
    const pointsStr = roiPoints.map(p => `${p.x * 100},${p.y * 100}`).join(' ');
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <polygon points={pointsStr} fill="rgba(0, 122, 255, 0.3)" stroke="#007aff" strokeWidth="2" />
        {roiPoints.map((p, i) => (
          <circle key={i} cx={`${p.x * 100}%`} cy={`${p.y * 100}%`} r="3" fill="#fff" stroke="#007aff" strokeWidth="1" />
        ))}
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

    // 2. Validate Algo
    if (algoMode === 'PRESET' && !selectedAlgoId) {
      alert("请选择一个预置算法");
      return;
    }
    if (algoMode === 'GENAI' && (!genAiResult || !genAiResult.valid)) {
      alert("请先进行 AI 解析并确保结果有效");
      return;
    }

    // 3. Validate Name
    if (!taskName.trim()) {
      alert("请输入任务名称");
      return;
    }

    // 4. Validate ROI Warning
    if (roiPoints.length === 0) {
       if (!window.confirm("未绘制检测区域，系统将默认检测全屏画面，是否继续？")) return;
    }

    let finalAlgo: Algorithm;
    if (algoMode === 'PRESET') {
      finalAlgo = PRESET_ALGORITHMS.find(a => a.id === selectedAlgoId)!;
    } else {
      finalAlgo = {
        id: `genai_${Date.now()}`,
        name: genAiResult?.object_name || 'AI Custom',
        description: genAiResult?.action_description || 'Custom AI Rule',
        version: 'v1.0-gen',
        icon: '🤖',
        type: 'GENAI'
      };
    }

    onSave({
      name: taskName,
      camera_ids: selectedCameras,
      roi: roiPoints,
      algorithm: finalAlgo,
      nlp_text: algoMode === 'GENAI' ? genAiInput : undefined,
      duration,
      alarm_level: alarmLevel,
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
            <Settings2 className="mr-2 text-blue-600" size={20}/> 新建智能分析任务
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-1 rounded-full transition-colors">
            <X size={24}/>
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
                      <div className="flex items-center"><Monitor size={16} className="mr-2"/> 1. 视频源选择</div>
                      <span className="text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        已选 {selectedCameras.length}
                      </span>
                   </h3>
                   <div className="bg-gray-50 rounded-lg border p-2 max-h-48 overflow-y-auto space-y-1">
                      {cameras.map(cam => (
                        <div 
                          key={cam.id}
                          className={`flex items-center p-2 rounded cursor-pointer transition-colors ${
                            activeCameraId === cam.id ? 'bg-blue-100 border border-blue-200' : 'hover:bg-gray-200 border border-transparent'
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

                <hr className="border-gray-100"/>

                {/* Section 2: Rules */}
                <section>
                   <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center">
                      <Cpu size={16} className="mr-2"/> 2. 规则定义
                   </h3>
                   
                   <div className="bg-gray-100 p-1 rounded-lg inline-flex w-full mb-4">
                      <button 
                        onClick={() => setAlgoMode('PRESET')}
                        className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${algoMode === 'PRESET' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        预置算法
                      </button>
                      <button 
                        onClick={() => setAlgoMode('GENAI')}
                        className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${algoMode === 'GENAI' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        AI 定制
                      </button>
                   </div>

                   {algoMode === 'PRESET' ? (
                      <div className="grid grid-cols-2 gap-3">
                        {PRESET_ALGORITHMS.map(algo => (
                          <div 
                            key={algo.id}
                            onClick={() => setSelectedAlgoId(algo.id)}
                            className={`border rounded-lg p-3 cursor-pointer transition-all hover:shadow-sm ${selectedAlgoId === algo.id ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 bg-white'}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-2xl">{algo.icon}</span>
                              {selectedAlgoId === algo.id && <CheckCircle2 size={16} className="text-blue-600"/>}
                            </div>
                            <div className="text-sm font-bold text-gray-800">{algo.name}</div>
                            <div className="text-xs text-gray-500 line-clamp-1">{algo.description}</div>
                          </div>
                        ))}
                      </div>
                   ) : (
                      <div className="space-y-3">
                         <textarea 
                           className="w-full h-24 p-3 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 resize-none bg-gray-50"
                           placeholder="描述场景，例如：检测未戴安全帽的人员..."
                           value={genAiInput}
                           onChange={(e) => setGenAiInput(e.target.value)}
                         />
                         <button 
                            onClick={handleParse}
                            disabled={isParsing || !genAiInput}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm flex items-center justify-center disabled:opacity-50"
                         >
                            {isParsing ? <Loader2 className="animate-spin mr-2" size={16}/> : <BrainCircuit className="mr-2" size={16}/>}
                            开始解析
                         </button>
                         {genAiResult && (
                            <div className="text-xs bg-green-50 text-green-800 p-2 rounded border border-green-200">
                               <span className="font-bold">解析成功:</span> {genAiResult.object_name} - {genAiResult.action_description}
                            </div>
                         )}
                         {genAiError && (
                            <div className="text-xs bg-red-50 text-red-600 p-2 rounded border border-red-200 flex items-center">
                               <AlertTriangle size={12} className="mr-1"/> {genAiError}
                            </div>
                         )}
                      </div>
                   )}
                </section>

                <hr className="border-gray-100"/>

                {/* Section 3: Params */}
                <section>
                   <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center">
                      <Settings2 size={16} className="mr-2"/> 3. 策略配置
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
                                     className={`flex-1 text-[10px] font-bold py-1.5 rounded border transition-all ${
                                        alarmLevel === lvl 
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
                           className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all ${
                              activeCameraId === cam.id 
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

             {/* Tools */}
             <div className="absolute top-4 right-4 z-20 flex space-x-2">
                <div className="bg-black/60 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full flex items-center shadow-lg border border-white/10 mr-2">
                   <MousePointer2 size={12} className="mr-2"/>
                   {roiPoints.length > 0 ? `已绘制 ${roiPoints.length} 个点` : '点击画面绘制'}
                </div>
                <button 
                   onClick={() => setRoiPoints([])}
                   className="bg-white text-red-600 px-3 py-1.5 rounded-lg shadow-lg text-sm font-medium flex items-center hover:bg-red-50 transition-colors"
                >
                   <Eraser size={14} className="mr-1.5"/> 清除区域
                </button>
             </div>
             
             {/* Canvas Area */}
             <div className="flex-1 p-8 flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pt-16">
                {activeCameraObj ? (
                  <div className="relative w-full h-full max-w-5xl max-h-[80vh] aspect-video bg-black rounded shadow-2xl overflow-hidden ring-1 ring-white/20">
                     <div 
                      ref={canvasRef}
                      className="relative w-full h-full cursor-crosshair group"
                      onClick={handleCanvasClick}
                     >
                        <img 
                          src={activeCameraObj.thumbnail} 
                          alt="Feed" 
                          className="w-full h-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
                        />
                        {/* Grid Overlay for precision feel */}
                        <div className="absolute inset-0 pointer-events-none opacity-10" 
                             style={{backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px'}}>
                        </div>

                        {renderROI()}
                        
                        {/* Hint */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-xs bg-black/40 px-3 py-1 rounded backdrop-blur pointer-events-none">
                           {activeCameraObj.name} - 实时预览
                        </div>
                     </div>
                  </div>
                ) : (
                  <div className="text-gray-500 flex flex-col items-center">
                    <Video size={64} className="mb-4 opacity-20 text-white"/>
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
            <Save size={18} className="mr-2"/>
            完成创建
          </button>
        </div>
      </div>
    </div>
  );
};