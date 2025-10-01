---
title: State Tree
description: 차세대 AI 시스템
author: gemini
date: 2025-10-01 19:00:00 +09:00
categories: [Unreal]
tags: [AI]
math: true
mermaid: true
---

#### State Tree란?

- State Tree는 Unreal Engine에서 제공하는 **상태 기반 제어 프레임워크**로, AI 행동뿐만 아니라 다양한 게임 플레이 로직을 구현할 수 있는 시스템

- 핵심 특징
	- **Behavior Tree의 유연한 태스크 실행 구조**
	- **State Machine의 직관적인 상태 전환 구조**
	- 두 시스템의 장점을 결합한 하이브리드 접근 방식


#### 플러그인 종류

- Gameplay State Tree
	- 게임 플레이 로직 및 **AI 행동 제어**에 특화
	- Behavior Tree를 대체하거나 보완하는 용도
	- 일반적으로 "AI State Tree" 라고 지칭
- State Tree (일반)
	- 범용적인 '상태 기계' 프레임 워크
	- UI 애니메이션, 미션 진행, 게임 플로우 등 **비AI 영역**에서도 활용
	- 상태 전환이 필요한 거의 모든 상황에 적용 가능


#### Behavior Tree vs State Tree

| 특징     | Behavior Tree | State Tree  |
| ------ | ------------- | ----------- |
| 구조     | 트리 기반 태스크 실행  | 상태 + 전환 기반  |
| 상태 표현  | 암묵적           | 명시적         |
| 전환 로직  | 복잡한 조건 분기 필요  | 직관적인 상태 전환  |
| 유지보수   | 복잡해질수록 어려움    | 구조적으로 명확    |
| GAS 연동 | 수동 구현 필요      | 자연스러운 연동 지원 |


#### State Tree 구성 요소

##### Schema (스키마)

- State Tree의 실행 컨텍스트를 정의하는 설정

- **StateTree Component**
	- **Actor 자체에 붙은 State Tree Copmponent**에서 실행
	- **AI Controller 불필요**
	- 독립적으로 동작하는 Actor 단위 상태머신에 적합
	- 예: 상호작용 오브젝트의 상태 관리 (꺼짐 -> 켜짐 -> 파괴됨)

- **StateTree AI Component**
	- **AI Controller에서 실행**되는 State Tree
	- Controller 하나가 여러 Pawn을 제어 가능
	- 여러 Pawn이 동일한 AI 로직을 공유할 때 유용
	- 예: 플레이어 근처에서 동시에 도망가는 여러 동물

- **커스텀 스키마** (**C++**)
	- 특정 Actor 타입 전용 고유 데이터가 필요할 때 사용
	- 대부분의 경우 기본 스키마로 충분


##### Context (컨텍스트)

- State Tree가 동작할 대상 Actor를 지정하는 설정

- **Context Actor Class**
	- State Tree가 어떤 Actor를 대상으로 동작할지 지정
	- Task 내에서 자동으로 참조 가능
	- 구체적으로 지정할수록 Task 작성이 편리함

- **AI Controller Class** (**AI Component 전용**)
	- AI Controller가 State Tree를 실행
	- Controller = 로직을 실행할 '두뇌'
	- Context Actor = 조종하는 '몸체(Actor/Pawn)'


##### Parameters (파라미터)

- State Tree 에셋에 정의하는 입력 변수

- 특징
	- 외부에서 값을 주입할 수 있는 설정값
	- 트리 시작 전에 세팅하는 초기 설정값
	- 런타임 중간에 자주 변경하는 용도가 아님

- Behavior Tree Blackboard와의 비교
	- Blackboard = 실시간 값 공유소 (동적)
	- Parameters = 시작 전 주는 설정값 (동적)

- 사용 예시
	- 순찰 거리, 탐지 변경, 기본 속도 등
	- 같은 트리를 여러 캐릭터에서 다른 값으로 재사용


#### State (상태)

- 캐릭터 또는 오브젝트가 현재 어떤 상태에 있는가를 나타내는 노드

- 특징
	- State Tree의 기본 구성 단위
	- 트리 구조로 배치되어 상황에 따라 판단
	- State 자체는 '상황'을 나타내고, Task가 '행동'을 담당

- State 타입
	- **State** : Task를 실행할 수 있는 기본 단위 (주로 사용)
	- **Group** : 상태를 묶어서 정리하는 용도
	- **Linked/Linked Asset/Subtree** : 다른 트리를 불러오는 고급 기능


##### Root State

- State Tree의 시작 지점이 되는 최상위 State

- 특징
	- State Tree 생성 시 자동 생성
	- 모든 실행은 Root에서 시작
	- Root 자체는 보통 Task를 포함하지 않음
	- Child State들을 관리하는 컨테이너 역할

- 실행 흐름
	1. State Tree 실행 시작
	2. Root 활성화
	3. Root의 Child 중 하나 선택
	4. 선택된 Child에서 행동 시작


##### Child State vs Sibling State

- Child State (자식 상태)
	- 계층적으로 "아래"에 있는 상태
	- Child가 선택되면 **부모도 함께 활성화**
	- 부모의 Task + 자식의 Task 동시 실행 가능
	- 용도 : 상위/공통 로직 + 세부 행동 레이어링

- 예시

```
Combat (부모: 타겟 유지/버프 관리)
├─ Chase (자식: 추적)
├─ Attack (자식: 공격)
└─ Retreat (자식: 이탈)
```

- Sibling State (형제 상태)
	- Parent의 Selection Behavior에 따라 **하나만 선택**되어 활성화
	- 서로 **상호 배타적**인 모드/단계 표현
	- 용도 : 같은 맥락 아래 전환되는 여러 케이스 배치

- 선택 기준
	- 공통 로직 유지 + 세부 행동 변경 -> **Child 구조**
	- 같은 단계의 여러 대안 중 하나만 실행 -> **Sibling 구조**


##### Selection Behavior

- Parent State가 어떤 Child State를 선택하고 실행할지 결정하는 규칙
- 옵션

| 옵션                                                | 설명                               | 용도              |
| ------------------------------------------------- | -------------------------------- | --------------- |
| None                                              | 선택하지 않음                          | 특수 상황           |
| Try Enter                                         | Parent 자신만 실행, 자식 무시             | Parent Task만 실행 |
| Try Select Children In Order                      | 위에서부터 순서대로 조건 검사 (기본값)           | 일반적인 선택         |
| Try Select Children At Random                     | 조건 통과한 Child 중 랜덤 선택             | 행동 다양성          |
| Try Select Children With Highest Utility          | Utility 점수가 가장 높은 Child 선택       | Utility AI      |
| Try Select Children At Random Weighted By Utility | Utility 점수 비율로 가중 랜덤 선택          | Utility + 랜덤    |
| Try Follow Transitions                            | Child 선택 없이  Transition 조건 우선 검사 | 전환 허브           |


#### Task 시스템

##### Task 정의

- State 안에서 실제로 실행되는 동작 단위

- 관계
	- State = 상황 (Idle, Patrol, Combat)
	- Task  = 그 상황에서 하는 일 (애니메이션, 이동, 공격)

- 특징
	- 한 State에서 여러 Task를 넣을 수 있음
	- State 진입 시 Task 시작, 이탈 시 Task 종료
	- State에 Task가 없으면 실제 행동이 없음


##### Task 생명주기 함수

| 함수             | 호출 시점             | 용도                       |
| -------------- | ----------------- | ------------------------ |
| EnterState     | State 진입 시 한 번    | 행동 시작 로직(이동, 애니메이션, 초기화) |
| ExitState      | State 이탈 시 즉시     | 빠른 정리 작업(순서 보장 안됨)       |
| StateCompleted | State 완전 종료 시     | 안정적인 종료 처리(순서 보장)        |
| Tick           | State 활성화 중 매 프레임 | 지속적 값 체크/업데이트 (성능 주의)    |
| GetDescription | 에디터 표시용           | 디버깅/가독성용 설명 문자열          |

- 권장 사항
	- 중요한 종료 로직은 **StateCompleted** 사용
	- Tick은 꼭 필요한 경우에만 사용 (성능 고려)


##### Finish Task의 진실

- `Finish Task`는 Task만 끝내는 것이 아니라 **State 전체를 종료**시킵니다

- 동작 방식
	- 한 State에 여러 Task가 동시 실행 가능
	- 그중 하나라도 `Finish Task` 호출 시 State 전체 종료
	- 사실상 `Finish State`와 동일한 효과

- 주의 사항
	- Delay Task를 같은 State에 넣으면 의도대로 동작하지 않음
	- 먼저 끝나는 Task가 State를 종료시키기 때문
	- 대기 동작은 별도 State로 분리 필요


##### Task 간 데이터 공유 (바인딩)

- Input 변수
	- Category를 `input`으로 설정
	- 반드시 다른 값에 바인딩해야 함
	- 수동 입력 필드 없음 (실수 방지)

- 바인딩 가능 대상
	1. **Parameters** - State Tree Asset의 설정값
	2. **Context Actor 변수** - 캐릭터에 선언된 변수
	3. **다른 Task Output** - 앞선 Task의 계산 결과

- Output 변수
	- Category를 `Output`으로 설정
	- 입력 필드가 사라지고 출력 전용이 됨
	- 다른 Task의 Input으로 바인딩 가능

- 데이터