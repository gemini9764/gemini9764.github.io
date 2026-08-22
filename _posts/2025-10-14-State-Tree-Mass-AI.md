---
title: State Tree와 Mass AI 군중 시뮬레이션
description: 차세대 AI 시스템
author: gemini
date: 2025-10-14 19:00:00 +09:00
categories: [Unreal]
tags: [AI]
math: true
mermaid: true
---

#### State Tree - Utility 기반 선택 시스템

##### Selection Utility Score 개요

- 상황에 따라 가장 점수가 높은 행동을 선택하게 만드는 시스템

- 기본 원리
	- 각 Child State마다 Score 계산
	- **Weight**를 곱하여 최종 점수 산출
	- 가장 높은 점수의 State 선택
- 주의할 점
	- Weight만 올려도 효과 없음
	- Score가 0이면 0 x Weight = 0
	- 먼저 Score Source를 정의해야 함


##### Score Scource 종류

- Constant (상수)
	- 고정된 숫자를 Score로 사용
	- 단순 우선순위 설정
	- 동적 선택에는 부적합
- 동적 값 (진짜 유용한 방식)
	- **HP 퍼센티지**
		- HP 높으면 공격, 낯으면 도망
	- **Distance**
		- 가까우면 공격, 멀면 순찰
	- **Context 변수**
		- 런타임 상황에 따른 점수


##### Utility 활용 패턴

- 기본 공식

```py
최종 점수 = Score x Weight
```

- 예시 1: HP 기반 선택

```py
공격 State : Score = HP% x Weight(1.5)
도망 State : Score = (1 - HP%) x Weight(2.0)

HP 80% : 공격 1.2, 도망 0.4 -> 공격 선택
HP 20% : 공격 0.3, 도망 1.6 -> 도망 선택
```

- 예시 2: 거리 기반 선택

```py
근접 공격 : Score = (1000 - Distance) / 1000
원거리 공격 : Score = Distance / 1000

Distance 200 : 근접 0.8, 원거리 0.2 -> 근접 선택
Distance 800 : 근접 0.2, 원거리 0.8 -> 원거리 선택
```


##### Utility vs Transition 비교

| 방식    | Utility Score | Transition Condition |
| ----- | ------------- | -------------------- |
| 선택 기준 | 점수 높은 순       | 조건 만족 여부             |
| 우선순위  | 동적 계산         | 고정 순서                |
| 복잡도   | 상황별 가중치 조절    | 명확한 조건 분기            |
| 적합성   | 연속적 상황 판단     | 명확한 케이스 분리           |

- 사용 기준
	- **단순하고 명확한 전환**
		- Transition Condition
	- **복잡한 우선순위 계산**
		- Utility Score
	- **연속적인 변수 기반 판단**
		- Utility Score


#### Mass AI - Zone Graphs

- Mass AI란?
	- **대규모 군중 시뮬레이션 시스템**으로 Entity Component System (ECS) 아키텍처를 사용

- 전통적인 AI vs Mass AI

| 구분    | 전통적인 AI               | Mass AI         |
| ----- | --------------------- | --------------- |
| 구조    | 개별 액터 + AI Controller | 경량 Entity + ECS |
| 적합 규모 | 수십 명                  | 수천 명            |
| 성능    | 개별 처리(느림)             | 일괄 처리(빠름)       |

- Zone Graph의 개념
	- **Zone Graph는 NPC의 이동 경로와 영역을 정의하는 내비게이션 시스템**
		- **NavMesh**
			- "어디를 걸을 수 있는가?"
		- **Zone Graph**
			- "어떤 경로를 따라 걸을 것인가?"

- Zone Graph 구성 요소
	- **Zone Shape (형태)**
		- **Spline**(**스플라인**)
			- 길, 보도, 복도 같은 선형 경로
		- **Polygon**(**폴리곤**)
			- 광장, 공원, 건물 내부 같은 넓은 영역
	- **Lanes**(**차선**)
		- 각 Zone Shape 내의 내부 이동 경로
			- **Width** : 차선의 폭
			- **Direction** : Forward(전진), Backward(후진), Both(양방향)
			- **Tags** : 접근 권한 제어
			- **Speed** : 속도 제한 (선택사항)
	- **Tags**(**태그**)
		- NPC 유형과 경로를 연결하는 분류 시스템
			- `Pedestrian` : 보행자용 경로
			- `Vehicle` : 차량용 도로
			- `HighClass` : VIP 전용 구역

- 태그 시스템 활용
	- 계층화된 세계 구축

```py
일반 농민 -> Pedestrian 태그만 -> 공공 도로만 접근
상인 -> Pedestrian + Merchant 태그 -> 상점 내부도 접근
귀족 -> All 태그 -> 성과 정원까지 접근
```


#### Mass Entity Config Asset

- Config Asset이란?
	- Mass Entity의 설계도
	- Blueprint가 액터를 정의하듯, Config Asset은 Mass 엔티티를 정의

- 핵심 개념
	- **Fragments**(**프래그먼트**)
		- 엔티티가 보유하는 데이터 조각
			- **Transform Fragment** : 위치와 회전
			- **Velocity Fragment** : 속도
			- **Health Fragment** : 체력
	- **Traits**(**특성**)
		- 엔티티에 기능을 추가하는 모듈
			- **Movement Trait** : 이동 기능
			- **Avoidance Trait** : 충돌 회피
			- **Animation Trait** : 애니메이션
	- **Processors**(**프로세서**)
		- Fragments를 처리하고 업데이트하는 시스템

- Traits와 Fragments의 관계

```
Movement Trait 추가
  ↓
자동으로 추가되는 Fragments:
  - Transform Fragment
  - Velocity Fragment
  - Movement Parameters Fragment
  ↓
Movement Processor 활성화
```

- 모듈식 설계의 장점
	- 필요한 기능만 선택적 추가
	- 메모리 효율성 극대화
	- 다양한 NPC 유형 쉽게 생성

- 자동으로 작동하는 시스템들
	- Config Asset에서 추가한 Traits 덕분에
		- **Avoidance Trait** : 다른 NPC와 충돌 예측 및 회피
		- **Movement Trait** : 부드러운 이동 처리
		- **Steering Trait** : 자연스러운 회전
		- **Navigate Obstacle Trait** : 장애물 우회
		***추가 코드 없이 자동으로 작동!***


#### Sync (동기화)

- Sync란?
	- Mass Entity(데이터)와 Visual Actor(3D 캐릭터) 사이의 정보 동기화

```py
Mass Entity (두뇌)
   ↕ Sync
Visual Actor (몸)
```

- 동기화 방향
	- **Mass to Actor** : Mass 계산 -> 액터 적용 (가장 일반적)
	- **Actor to Mass** : 액터 상태 -> Mass 전달
	- **Both Ways** : 양방향 동기화

- 예시
	- Agent Movement Sync (Mass to Actor)

	```py
	Mass가 새 위치 계산 -> Visual Actor를 그 위치로 이동
	```

	- Player Navigation Obstacle (Actor to Mass)

	```py
	플레이어 이동 -> Mass 시스템에 위치 알림 -> NPC가 회피
	```


#### Wander (배회) State 구현

- Wander의 두 단계
	- **목표 찾기** : 어디로 갈지 결정
	- **이동하기** : 그곳까지 경로 따라 이동

- Task 구성
	- Task 1 : ZG Find Wander Target

	```
	현재 위치에서 Zone Graph 검색
		↓
	태그 필터링 (Pedestrian, HighClass)
		↓
	무작위 지점 선택
		↓
	Output : Wander Target Location
	```

	- Task 2 : ZG Path Follow

	```
	Input : Wander Target Location (Task 1의 출력)
		↓
	경로 계산
		↓
	경로 따라 이동
	```

- Transition 설정
	- On State Completed -> Transition to Root

	```py
	Wander 완료 -> Root로 돌아가기 -> Wander 재시작 -> 무한 반복
	```


#### Mass AI 디버깅

- 디버그 명령어 (게임 내 \` 키)
	- **기본 뷰** : Mass 데이터 + 위치
	- **Shift + V** : 속도, 상태 등 추가 정보
	- **Shift + O** : 회피 (Avoidance) 시각화
	- **Shift + C** : 경로 (Zone Graph) 표시
	- **Shift + S** : Shape 표시

- 시각적 요소
	- **원** : Mass 엔티티 위치
	- **메시** : Visual Actor 위치
	- **화살표** : 이동 방향과 의도
	- **노란색 선** : 목표 방향 (Smooth Orientation)
	- **작은 선들** : 회피 벡터
	- **Maroon 화살표** : 원하는 목적지


#### 플레이어 - NPC 상호작용

- 문제
	- NPC는 다른 Mass 엔티티만 인식
	- 플레이어는 Mass 엔티티가 아님
	- 결과 : NPC가 플레이어를 "보지 못한"

- 해결 : Navigation Obstacle
	- 플레이어를 Mass 시스템에 등록

	```py
	Player Config Asset 생성
		↓
	Traits 추가
		- Agent Capsule Collision Sync (Actor to Mass)
		- Navigation Obstacle
		↓
	플레이어 위치를 매 프레임 Mass에 전달
		↓
	NPC가 플레이어를 회피
	```