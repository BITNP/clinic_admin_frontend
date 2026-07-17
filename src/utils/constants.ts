export const RECORD_STATUS_DESC: Record<string, string> = {
  'pending': '预约待确认',
  'confirmed': '预约已确认',
  'arrived': '已到诊所',
  'in_progress': '正在处理',
  'completed': '已解决问题',
  'rejected': '预约已驳回',
  'referred': '建议返厂',
  'no_show': '未到诊所',
}

export const repairMethods = [
  {
    label: "硬件",
    value: "硬件",
    children: [
      { label: "清灰", value: "清灰" },
      { label: "换硅脂", value: "换硅脂" },
      { label: "安装硬盘", value: "安装硬盘" },
      { label: "更换部件", value: "更换部件" },
    ]
  },
  {
    label: "系统",
    value: "系统",
    children: [
      { label: "重装", value: "重装" },
      { label: "系统还原", value: "系统还原" },
      { label: "清理文件", value: "清理文件" },
      { label: "更新驱动", value: "更新驱动" },
    ]
  },
  {
    label: "软件",
    value: "软件",
    children: [
      { label: "安装", value: "安装" },
      { label: "卸载", value: "卸载" },
      { label: "清理残留", value: "清理残留" },
      { label: "配置", value: "配置" },
    ]
  },
  {
    label: "其他",
    value: "other"
  }
]

export const probDescs = [
  {
    label: "硬件",
    value: "hardware",
    children: [
      { label: "过热", value: "hardware.overheat" },
      { label: "清灰", value: "hardware.cleaning" },
      { label: "硅脂", value: "hardware.siliconGrease" },
      {
        label: "硬盘", value: "hardware.disk",
        children: [
          { label: "安装", value: "hardware.disk.install" },
          { label: "更换", value: "hardware.disk.replace" },
          { label: "迁移", value: "hardware.disk.migrate" },
        ]
      },
      { label: "进水", value: "hardware.water" },
      { label: "屏幕", value: "hardware.screen" },
    ]
  },
  {
    label: "系统",
    value: "系统",
    children: [
      {
        label: "安装", value: "system.install",
        children: [
          { label: "Windows", value: "system.install.Windows" },
          { label: "Linux", value: "system.install.Linux" },
        ]
      },
      { label: "重装", value: "system.reinstall" },
      { label: "蓝屏修复", value: "system.bsod" },
      { label: "文件清理", value: "system.cleaning" },
      { label: "网络", value: "system.network" },
      { label: "配置 Linux", value: "system.linuxConfig" },
    ]
  },
  {
    label: "软件",
    value: "软件",
    children: [
      {
        label: "安装", value: "安装",
        children: [
          { label: "AutoCAD", value: "software.install.AutoCAD" },
          { label: "ANSYS", value: "software.install.ANSYS" },
          { label: "Matlab", value: "software.install.Matlab" },
          { label: "Office", value: "software.install.Office" },
          { label: "SolidWorks", value: "software.install.SolidWorks" },
          { label: "其他", value: "software.install.other" },
        ]
      },
      { label: "卸载", value: "卸载" },
      {
        label: "配置", value: "配置",
        children: [
          { label: "C / C++ 运行环境", value: "software.config.CppEnv" },
        ]
      },
    ]
  },
  {
    label: "其他",
    value: "other"
  }
]
