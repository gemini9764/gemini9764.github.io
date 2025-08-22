---
title: 애니메이션 시스템의 기초 원리
description: 애니메이션 시스템의 기초 원리와 최적화
author: gemini
date: 2025-08-22 17:00:00 +09:00
categories: [Unreal]
tags: [Animation]
math: true
mermaid: true
---

#### 애니메이션의 원리

- 전통 애니메이션 vs 3D 게임 애니메이션

|구분|전통 애니메이션|3D 게임 애니메이션|
|---|---|---|
|제작 방식|프레임별 직접 그리기|수학적 계산|
|독립성|각 프레임 완전 독립|키프레임 + 보간|
|변경 가능성|어려움|실시간 수정 가능|

- Transform - 모든 움직임의 기본 단위

```
Transform = Location + Rotation + Scale

• Location (위치): Vector3 (X, Y, Z)
• Rotation (회전): Euler Angles (Roll, Pitch, Yaw)
• Scale (크기): Vector3 (X, Y, Z)
```

- 스켈레톤 시스템
	- **뼈 (Bone)** : 각각 Transform 정보를 가짐
	- **계층 구조** : 부모-자식 관계로 연결
	- **상속 원리** : 부모 뼈가 움직이면 자식 뼈도 따라 움직임

- 키프레임 애니메이션
	- **키프레임** : 중요한 순간의 포즈만 저장
	- **보간(Interpolation)** : 키프레임 사이를 자동 계산
		- 선형 보간 : 일정한 속도 (기계적)
		- 곡선 보간 : Ease In/Out (자연스러운)

- 회전의 복잡성
	- **오일러 회전** : Roll, Pitch, Yaw 순서로 적용
	- **짐벌락** : 특정 각도에서 축이 겹치는 현상
	- **쿼터니언** : 안정적인 내부 회전 표현 방식


#### 애니메이션 블랜딩

- 단일 애니메이션의 한계
	- 각 상황마다 별도 애니메이션 필요
	- 전환 시 끊김 현상 발생
	- 중간 속도나 방향 표현의 어려움

- Animation Blueprint 구조

```
Animation Blueprint
├── Event Graph (상황 판단)
└── Anim Graph (애니메이션 선택 및 블렌딩)
```

- 1D Blend Space
	- **용도** : 속도에 따른 애니메이션 블렌딩
	- **예시** : Idle (0) -> Walk (200) -> Run (375)
	- **보간** : 중간값에서 두 애니메이션을 비율로 섞음

- 2D Blend Space
	- **축** : X축 (속도), Y축 (방향)
	- **보간 방식** : 삼각형 기반 (3개 애니메이션 조합)
	- **가중치 계산** : 무게중심 좌표 사용

- 동기화 문제와 해결책
	- 문제 : 서로 다른 타이밍의 애니메이션 블렌딩
	- 해결책 : Sync Marker로 중요한 순간 동기화
	- Root Motion : 발 미끄러짐 방지


#### 상태 기반 애니메이션

- State Machine이란?
	- 정의 : 상태(State)와 전환 규칙(Transition)으로 구성된 시스템
	- 목적 : 복잡한 애니메이션 흐름을 논리적으로 정리

- 구성 요소

```
State Machine
├── State (상태) - 특징: 한 번에 하나의 상태만 활성화
│   ├── 단일 애니메이션
│   └── Blend Space (여러 애니메이션 조합)
└── Transition (전환) - 상태에서 상태로 넘어가는 규칙
    ├── 조건 (Condition)
    └── 우선순위
```

- 전환 조건 예시

```
Idle/Walk/Run → Jump Start
조건: Is In Air == True

Jump Start → Jump Loop
조건: Time Remaining < 0.1

Jump Loop → Jump Land
조건: Is In Air == False
```

- 전환 품질 향상
	- **Crossfade (기본 전환)** : 두 애니메이션을 시간에 따라 선형 블렌딩
		- 원리 : 시간에 따른 선형 블렌딩
		- Duration 0.2초 설정시 프레임별 가중치
			- 0.0초 : 이전 상태 100%, 다음 상태 0%
			- 0.1초 : 이전 상태 50%, 다음 상태 50%
			- 0.2초 : 이전 상태 0%, 다음 상태 100%
		- 장점 ; 부드러운 전환
		- 단점 : 비현실적인 중간 자세 가능
	- **Inertializtion (고급 전환)** : 속도와 가속도를 고려한 자연스러운 전환
		- 개선점 : 뼈의 속도와 가속도 고려
		- 현재 팔이 빠르게 앞으로 휘두를 때
			- 새 상태로 전환 시 급격한 방향 변경 방지
			- 관성을 유지하면서 서서히 새 포즈로 이동
		- 결과 : 실제 물리 움직임처럼 자연스러운 전환

- 다른 시스템과의 협력

|시스템|역할|특징|
|---|---|---|
|State Machine|기본 동작 관리|한 번에 하나의 상태|
|Layered Blend|신체 부위별 분리|상체/하체 독립 제어|
|Montage|즉시 실행 애니메이션|이벤트 기반 삽입|


#### 애니메이션 최적화

- 성능 병목 분석

```
매 프레임마다 발생하는 계산

1. Event Graph 연산 (상황 분석)
2. Animation Graph 연산 (애니메이션 선택)  
3. Pose 계산 (뼈 위치 확정)
4. Mesh Deformation (메시 변형)

캐릭터 1명 = 약 200~300개 복잡한 수학 연산
캐릭터 50명 = 10,000~15,000개 연산
60fps = 1초에 수십만 번 연산
```

- CPU가 담당
	- Animation Graph 연산
	- State Machine 로직
	- Transform 계산
	- IK, Constraints
- GPU가 담당
	- Mesh Deformation (버텍스 변형)
	- 렌더링 (화면에 그리기
- **병목 : CPU 계산이 늦으면 GPU가 아무리 빨라도 소용없음**

- LOD (Level of Detail) 시스템
	- 사람 눈의 특성 활용
		- 가까운 사람 : 눈동자 움직임까지 보임
		- 50m 떨어진 사람 : 손가락 움직임 안보임
	- 거리에 따라 디테일 수준을 다르게 적용

|LOD 레벨|거리|삼각형 수|뼈 수|용도|
|---|---|---|---|---|
|LOD 0|0-15m|13,000개|75개|주인공|
|LOD 1|15-30m|6,500개|50개|가까운 NPC|
|LOD 2|30-60m|3,200개|30개|중거리 NPC|
|LOD 3|60m+|800개|15개|배경 군중|

- Update Rate 최적화
	- 핵심 아이디어
		- 모든 캐릭터가 60fps로 업데이트될 필요 없음
			- 눈앞의 적 : 60fps (매 프레임)
			- 중간 거리 NPC : 30fps (2프레임마다)
			- 멀리 있는 군중 : 15fps (4프레임마다)
		- 플레이어는 차이를 거의 못 느낌
		- CPU는 엄청난 계산량 절약

	- URO (Update Rate Optimization)
		- 언리얼 내장 기능
			1. Skeletal Mesh Component 선택
			2. Optimization -> Update Rate Optimization 활성화
			3. 자동으로 거리에 따라 업데이트 주기 조절
		- 보간 처리
			- 프레임 건너뛰기로 생기는 끊김 방지
			- 이전 값과 다음 값 사이를 자동 계산
			- 부드러운 움직임 유지

- 적응적 Update Rate
	- 성능 기반 조절
		- FPS 낮으면 : 전체 update Rate 감소
		- FPS 높으면 : Update Rate 증가
	- 중요도 기반 조절
		- 플레이어 시야 내 : 높은 Update Rate
		- 뒤쪽/가려진 캐릭터 : 낮은 Update Rate
		- 전투 중 : 무조건 높은 Update Rate

- 메모리 최적화
	- 압축 기법
		- Remove Linear Keys : 중간 키프레임 제거
		- Quantization : 정밀도 낮추기
		- Curve Fitting : 수학적 곡선으로 근사
	- 선택적 압축
		- 주인공 : Error Threshold 0.01 (최고 품질)
		- 주요 NPC : Error Threshold 0.1 (표준 품질)
		- 배경 캐릭터 : Error Threshold 1.0 (저품질)

- 컬링 (Culling) 시스템
	1. Frustum Culling (시야각 컬링)
		- 카메라 시야 범위 밖 제거
		- 언리얼이 자동 처리

	2. Distance Culling (거리 컬링)
		- Max Draw Distance 설정
		- 일정 거리 이상에서 렌더링 중단

	3. Occlusion Culling (가림 컬링)
		- 다른 물체에 가려진 객체 처리
		- 하드웨어 Occlusion Query 활용