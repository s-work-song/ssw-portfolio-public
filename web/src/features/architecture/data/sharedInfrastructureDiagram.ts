/** Pi K3s 배포 정의에서 확인한 주요 공용·운영 서비스. 주소와 실행 설정은 공개하지 않는다. */
export const sharedInfrastructureServices = [
  { id: 'Auth', title: 'Auth · 인증', role: 'JWT 발급·갱신 · 공개키' },
  { id: 'File', title: 'File · 파일', role: '업로드 · 다운로드' },
  { id: 'Media', title: 'Media · 미디어', role: '이미지 원본 · 파생본' },
  { id: 'Chat', title: 'Chat · 채팅', role: 'SignalR · 상담 이력' },
  { id: 'Config', title: 'Config · 설정', role: '공용 설정 관리' },
  { id: 'Notification', title: 'Notification · 알림', role: '알림 발송' },
  { id: 'Scheduler', title: 'Scheduler · 스케줄', role: '예약 작업 실행' },
  { id: 'Monitoring', title: 'Monitoring · 모니터링', role: '상태 · 지표 수집' },
  { id: 'Logging', title: 'Logging · 로그', role: '공용 로그 수집' },
  { id: 'Analytics', title: 'Analytics · 분석', role: '이벤트 · 통계' },
  { id: 'Tracing', title: 'Tracing · 추적', role: '요청 흐름 추적' },
  { id: 'Remote', title: 'Remote · 원격', role: '원격 연결 지원' },
  { id: 'Backup', title: 'Backup · 백업', role: '백업 · 복구 운영' },
] as const;

export const sharedInfrastructureDeploymentSource = `flowchart TB
    Client["브라우저 · 연동 서비스"]
    Tunnel["Cloudflare Tunnel"]
    subgraph Pi["Raspberry Pi"]
      subgraph Cluster["K3s · 서비스별 독립 워크로드"]
        Gateway["Rust 공용 인프라 게이트웨이"]
${sharedInfrastructureServices.map(service => `        ${service.id}["${service.title}<br/>${service.role}"]`).join('\n')}
        Storage[("서비스별 DB · 캐시 · 파일 볼륨<br/>내부 연결")]
${sharedInfrastructureServices.map(service => `        Gateway --> ${service.id}`).join('\n')}
        Auth --> Storage
        Config --> Storage
        File --> Storage
        Chat --> Storage
      end
    end
    Client -->|"공용 API 요청"| Tunnel
    Tunnel --> Gateway`;
