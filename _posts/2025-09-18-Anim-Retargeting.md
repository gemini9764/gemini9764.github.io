---
title: 애니메이션 리타겟팅
description: 애니메이션 리타겟팅
author: gemini
date: 2025-09-18 19:00:00 +09:00
categories: [Unreal]
tags: [Animation]
math: true
mermaid: true
---

#### 애니메이션 리타겟팅 이전 알아둬야 할 것들

##### 애니메이션 기본 에셋

- Skeleton (SK_)
	- 본(Bone) 계층 구조를 정의하는 자산
	- 실제 메시나 애니메이션 데이터는 없음
	- 역할
		- 애니메이션에서 나오는 본 트랜스폼 데이터를 Skeletal Mesh에 적용
		- 애님 노티파이, 커브 데이터 등 공통 메타데이터 관리
	- 하나의 Skeleton은 여러 Skeleton Mesh에서 공유 가능 (본 계층이 같으면)

- Skeleton Mesh (SKM_)
	- 실제 **3D 캐릭터 메시 + 본 스킨 정보**가 들어있는 자산
	- 메시가 특정 Skeleton 계층에 스킨되어 있음
	- 포함하는 것
		- 머티리얼, 피직스 에셋, LOD 정보 등
	- Skeleton과 1:1 관계를 가짐 (같은 본 계층을 공유)

- Animation
	- 본의 **움직임(트랜스폼)** 데이터를 담고 있는 자산
	- 특정 Skeleton을 대상으로 만들어져 있음
	- 특징
		- 본 이름과 계층만 같으면 같은 Skeleton을 공유하는 모든 Skeleton Mesh에서 재생 가능
		- 애니메이션 자체는 Mesh와 무관 -> Skeleton만 맞으면 재생됨


##### Root Motion

- Root Motion은 3D 캐릭터 애니메이션에서 사용되는 기술로, **애니메이션 데이터 자체가 캐ㄱ터의 이동을 제어하는지 여부**를 나타내는 용어. 캐릭터의 가장 상위 계층에 있는 '루트 본(root bone)'의 움직임에 따라 결정된다

- Root Motion 없음
	- **루트 본이 제자리에 고정**되어 있다
	- 캐릭터는 걷거나 뛰는 애니메이션을 재생하지만, 실제 위치는 변하지 않고 제자리에서 움직인다
	- 게임 월드에서의 실제 이동은 애니메이션과 별개로 **게임 코드를 통해 직접 제어**된다. (ex) '초당 5미터 앞으로 이동시켜라')
	- 이 방식은 프로그래머가 캐릭터의 움직임을 정밀하게 제어하기 쉽다는 장점이 있지만, 애니메이션 속도와 코드 상의 이동 속도가 맞지 않으면 **발이 바닥에서 미끄러지는 듯한 현상**이 발생할 수 있다

- Root Motion 있음
	- 애니메이션을 만들 때 **루트 본 자체를 직접 움직여서 이동**시킨다
	- 애니메이션 데이터 안에 캐릭터의 이동 거리, 회전값 등 모든 움직임 정보가 포함되어 있다
	- 게임 엔진은 이 애니메이션에 포함된 루트 본의 움직임 값을 그대로 캐릭터의 실제 위치 적용한다
	- 움직임이 애니메이션에 정확히 맞춰지기 때문에 발이 미끄러지는 현상 없이 **훨씬 자연스럽고 사실적인 움직임**을 만들어낼 수 있다


##### Animation Retargeting이란?

- [애니메이션 리타겟킹 언리얼 문서](https://dev.epicgames.com/documentation/ko-kr/unreal-engine/animation-retargeting-in-unreal-engine)
- 서로 다른 캐릭터 간에 애니매이션을 변환하는 과정
- 동일한 캐릭터 모델이라도, 내부 **스켈레톤 구조(본 계층)** 가 다르면 리타겟팅이 필요
- 골격의 차이 정도에 따라 어떤 리타게팅 방법이 필요하거나 적절할 지가 결정된다


##### 애니메이션 포즈를 복사/공유하는 방식

- Copy Pose From Mesh
	- **Animation Blueprint 노드**
	- 하나의 Skeleton Mesh Component에서 다른 Skeleton Mesh Component로 현재 포즈(본 변환 상태)를 그대로 복사한다
	- 주로 **메쉬를 여러 개 겹쳐서 사용할 때** 쓰인다
		- 예: 캐릭터 기본 본체 + 추가 의상 메쉬 + 장비 메쉬
		- 본체 메쉬에서 애니메이션이 재생되면, 의상과 장비도 동일한 뼈 움직임을 따라가도록 복사

- Set Leader Pose Component
	- **Blueprint 노드**
	- 한 개의 Skeletal Mesh Component(리더)가 있고, 그 밑에 여러 **자식 Skeletal Mesh Components**가 붙어있을 때 사용
	- 리더의 포즈를 자식 메쉬들이 자동으로 따라가게 설정한다
	- `Copy Pose From Mesh`와 비슷하지만, 여러 자식 메쉬가 한 번에 리더 포즈를 따라가므로 더 효율적이다


#### IK Rig와 IK Retargeter

##### IK Rig

- **IK Rig**는 특정 스켈레톤에 대해 IK(역운동학) 기반의 **리깅 데이터 에셋**을 만드는 시스템
- 주요 기능
	- 스켈레톤 본 계층을 불러와서, **Chain(본 체인)** 을 정의할 수 있음 (예: LeftArm, RightLeg)
	- 각 체인에 IK Solver(Full Body IK, Two Bone IK 등)을 적용할 수 있음
	- **골격의 구조가 달라도 공통된 Chain 정의**를 통해 리타겟팅 준비가 가능해짐
	- 애니메이션 전송 뿐 아니라, 런타임에서 IK 제어(무기 잡기, 발바닥 맞추기 등)에도 활용 가능
	- 즉, IK Rig는 "이 스켈레톤을 어떤 방식으로 이해하고 다룰지"에 대한 설명서 같은 역할


##### IK Retargeter

- **IK Retargeter**는 **소스 IK Rig -> 타겟 IK Rig** 사이의 **애니메이션 매핑 도구**
- 주요 기능
	- 소스와 타겟 스켈레톤의 체인 매칭 (예: Source.LeftArm -> Target.LeftArm)
	- 스케일/길이 차이 자동 보정 (키가 다른 캐릭터 간에도 애니메이션 왜곡 최소화)
	- 런타임/에디터에서 애니메이션을 변환 가능
		- 특정 애니메이션 스퀸스를 타겟 캐릭터용으로 변환 후 애셋으로 저장
		- Anim BP 내에서 Retargeter Node를 사용해 런타임 변환도 가능
	- **포즈 매칭** 옵션 제공 (A Pose -> A Pose, A Pose -> T Pose 등 맞춤 가능)


##### 사용 순서

1. IK Rig 생성
	- Source Skeleton (예: 마네킹 A)용 IK Rig 생성
	- Target Skeleton (예: 캐릭터 B)용 IK Rig 생성
	- 각각의 Bone을 Control Chains로 묶어줌 (팔, 다리, 척추 등)
2. IK Retargeter 생성
	- Source IK Rig + Target IK Rig을 선택해서 Retargeter를 만듦
	- Retargeter Pose, Pelvis, FK, IK, Post 단계별 세부 조정 가능
3. 애니메이션 리타겟팅
	- Retargeter 에셋에서 원하는 애니메이션 (Sequence, BlendSpace, AnimBP 등)을 Target Skeleton 버전으로 변환


#### IK Rig 생성
##### Full Body IK 세팅

>**Full Body IK (FBIK)란?**<br>
>언리얼 엔진 5에 새로 들어온 **전신 (Iverse Kinematics) 솔버**<br>
>말 그대로 "한 부분(예: 손, 발)"을 움직이면, 그 영향을 받아서 **몸 전체가 자연스럽게 따라 움직이도록 계산해 주는 시스템**
{: .prompt-info}

- 기존 IK랑 다른 점
	- 기존 IK (Two Bone IK 등)
		- 특정 관절 (예 : 팔꿈치 포함한 팔, 무릎 포함한 다리) 정도만 해결
		- "손"을 특정 위치에 붙이면 팔만 움직임 -> 몸통이나 다른 쪽 팔은 그대로
	- Full Body IK
		- 전신 단위로 연결된 본(bone) 체계를 고려해서 해결
		- "손"을 잡아당기면 어깨, 가슴, 골반까지 영향을 줘서 **자연스럽게 전신 포즈**가 만들어짐

- FBIK로 할 수 있는 예시
	- 캐릭터 발을 지면에 붙이기 (Foot Placement)
		- 울퉁불퉁한 지형에서도 양 발이 정확히 땅에 닿음
	- 손을 물체에 붙이기
		- 벽 잡기, 사다리 오르기, 총기 잡기 같은 상호작용

- Full Body IK Bone Settings
	- **Stiffness (강성)**
		- `Rotation Stiffness`
			- 회전이 원래 위치(애니메이션 포즈)로 돌아가려는 힘의 강도
			- 값이 클수록 원래 포즈를 강하게 유지
		- `Position Stiffness`
			- 위치(translation)을 유지하려는 힘
			- 보통 관절에서는 0으로 둠
	- **Limits (제약 조건)**
		- **X, Y, Z** : 각 축에 대해 회전 제약을 어떻게 둘지 설정
			- `Free` : 제약 없음. 자유롭게 회전
			- `Limited` : 범위 지정 가능
			- `Locked` : 해당 축 회전 고정
		- **Min/Max** : `Limited`일 때 회전 허용 범위(도 단위)
	- **Preferred Angles (선호 각도)**
		- **Use Prefered Angles**
			- 체크하면 물리 시뮬레이션 시 특정 각도로 관절이 움직이려는 경향을 가짐
		- **Preferred Angles (X, Y, Y)**
			- 선호하는 기본 각도값
	- **Bone Settings**
		- **Bone** : 이 제약 조건이 적용되는 뼈 이름


##### Full Body IK goal settings

- Bone Name
	- 어떤 뼈에 이 Effector를 적용할 지 지정 (`R_Foot` -> 오른발)
- Chain Depth
	- 선택한 뼈에서 위쪽으로 몇 개의 부모 본까지 영향을 줄지 결정
	- `0`이면 해당 뼈만
	- `1`이면 발 -> 정강이까지
	- `2`이면 발 -> 정강이 -> 허벅지까지 영향을 준다
	- 보통 발 IK에서는 최소 2 이상을 주어야 다리 전체가 움직임
- Strength Alpha (0~1)
	- Effector가 목표 위치를 얼마나 강하게 따라갈지
	- `1.0` -> 완전히 목표를 따름
	- `0.5` -> 절반만 영향
	- `0.0` -> 영향 없음
- Pull Chain Alpha (0~1)
	- IK 체인이 목표를 따라가는 강도
	- 1에 가까울수록 골반이나 허벅지까지 크게 움직여 따라감
- Pin Rotation (0~1)
	- Effector가 목표 위치뿐 아니라 회전(Rotation)까지 얼마나 고정하려는지
	- `1.0` -> 회전까지 따라감
	- `0.0` -> 위치만 따라감


##### IK Goal Settings

- Goal Name
	- 이 Goal을 구분하는 이름 (예: `RightFootIK`)
	- Effector에서 이 Goal 이름을 지정해 연결해야 실제로 뼈가 해당 위치를 따라간다
- Bone Name
	- 어떤 뼈에 대응되는 Goal인지 (여기서는 `R_Foot`)
- Position Alpha (0~1)
	- Goal **위치(Position)** 영향을 얼마나 적용할지
	- `1.0` -> 위치를 완전히 Goal로 따라감
	- `0.0` -> 전혀 영향을 주지 않음
- Rotation Alpha (0~1)
	- Goal **회전(Rotation)** 을 얼마나 적용할지
	- 보통 발 IK에서는 `1.0`으로 두어 지면에 발이 회전까지 잘 맞게 함
- Preview Mode
	- **Additive**
		- 원래 애니메이션에 Goal의 보정값을 더함
	- **Absolute**
		- 원래 애니메이션을 무시하고 Goal 위치/회전을 강제로 적용
	- 대부분 발 IK 같은 곳은 Additive를 사용


##### Transforms

- **Current / Reference**
	- 뷰포트에서 현재 Goal의 트랜스폼을 볼지, 레퍼런스 포즈 기준으로 볼지 전환


##### Viewport Goal Settings

- Size Multiplier
	- 뷰포트에서 Goal Gizmo(시각적 핸들)의 크기를 조정
- Thickness Multiplier
	- Goal gizmo의 선 굵기 조정


##### Exposure

- Expose Position
	- Goal의 위치값을 블루프린트/애님 그래프에서 노출 가능하게 함 (다른 노드에서 접근 가능)
- Expose Rotation
	- Goal의 회전값도 외부에서 접근할 수 있도록 공개


#### IK Retargeter 생성

1. **Retarget Pose**
	- **리타겟 대상 캐릭터의 기준 자세(Base Pose)** 를 말한다
	- 보통 **A-포즈**나 **T-포즈** 같은 정적인 포즈를 기준으로 삼는다
	- 소스 메쉬(애니메이션 원본 캐릭터)와 타겟 메쉬(애니메이션 받을 캐릭터)의 본 구조가 다르거나 관절 기본 회전이 다를 때, 이 차이를 보정하는 역할

2. Pelvis / Retarget Root
	- 예전에는 Retarget Root라 불렸지만 Root 용어가 애니메이션에서 너무 많이 쓰여서 Pelvis로 수정되었다
	- 캐릭터 모션의 기준 **Pelvis 본**으로 두는 게 기본 구조
	- 소스 캐릭터의 pelvis를 타겟 캐릭터로 그대로 전달
	- Pelvis Motion을 제어할 수 있는 옵션들이 추가됨
		- **Blend to Source**
			- 소스 애니메이션의 Pelvis 움직임을 어느 정도 섞을지 (블렌딩 비율)
		- **Scale**
			- 캐릭터 신체 비율 차이에 따라 Pelvis 이동량/회전량을 축소 확대
		- **Affect IK**
			- Pelvis Motion이 IK 체인에도 영향을 줄지 여부

3. FK Retargeting
	- Forward Kinematics
		- 계산 방향 : Root -> End (부모에서 자식으로)
	- 소스/타겟 캐릭터의 IK Rig에서 **체인(Chain)** 을 정의해야 함
	- 소스와 타겟 체인의 **본 개수가 달라도 상관없음**
	- 체인 길이를 정규화하여 복제 동작을 생성한 후 뼈 회전 값을 생성한다
		- 소스 체인과 타겟 체인의 길이를 정규화(normalize)
			- 서로 팔/다리 길이가 달라도 비율을 맞춤
		- 체인의 시작점과 끝점 위치를 맞춘 뒤
		- 그 사이 본들의 **회전(Bone Rotation)을 자동으로 생성**해서 애니메이션을 전달

4. IK Retargeting
	- Inverse Kinematics
		- End -> Root (끝에서 거슬러 올라감)
	- Full Body IK
		- 정의된 루트와 다중 역운동학(IK) 이펙터를 가진 다중 뼈 사슬을 처리하는 위치 기반 솔버
		- **Position-base Solver** -> 위치를 기준으로 본 체인을 푸는 방식 (기존 CCD, FABRIK 같은 전통적인 IK 알고리즘과 비슷하지만 더 범용적)
		- 여러 개의 본 체인을 동시에 다룸
		- 하나의 루트(Root)에서 출발해서 여러 개의 IK Effector(손, 발, 머리 같은 목표 지점)를 처리할 수 있다
	- Run IK Rig
		- 현재 캐릭터에 설정된 IK Rig(본 체계 + IK 설정)를 실행하는 메인 노드
		- 아래쪽에 추가된 세부 노드들이 이 안에서 차례대로 적용
		- **Retarget IK Goals**
			- 애니메이션 리타겟팅 시, 원본 캐릭터에서 설정된 IK  목표 지점 (예: 발 위치, 손 위치 등)을 현재 캐릭터의 본 구조에 맞게 변환해주는 역할
			- 다른 스켈레톤에서 가져온 애니메이션을 현재 캐릭터에 맞게 보정할 때 필요
		- **Speed Plant IK Goals**
			- 발이 땅에 닿을 때 속도에 맞춰 자연스럽게 붙도록 보정하는 기능
			- 예를 들어 달릴 때 발이 미끄러지지 않고 지면에 "붙어 있는 듯" 보이게 해준다
			- 속도 기반으로 계산하기 때문에 걷기/뛰기 전환 시에 특히 중요
		- **Stride Warp IK Goals**
			- 보폭 길이를 동적으로 조정하는 기능
			- 캐릭터 이동 속도에 맞게 애니메이션의 보폭을 늘리거나 줄여서 **발 미끄러짐(Sliding)** 을 최소화
			- 예를 들어, 원래 애니메이션이 "1m 보폭"이라도 캐릭터 속도가 빨라지면 보폭을 1.2m, 1.5m로 늘려서 자연스럽게 보이게 한다

5. Post Retarget
	- 리타겟팅으로는 완벽하지 않아서, **리타겟팅된 애니메이션의 맥락을 이해**해야 추가 보정이 가능
	- **Pinning IK Bone (IK 본 고정)**
		- 리타겟팅 후 특정 본들이 의도치 않게 움직일 수 있음
	- **Regenerating Root Motion (루트 모션 재생성)**
		- 원본과 타겟 캐릭터의 체형 차이로 루트 모션이 부정확해질 수 있음
	- **Curve Remapping (커브 리매핑)**
		- 애니메이션 커브들 (페이셜, 블렌드 가중치 등)을 새 캐릭터에 맞게 조정

6. Op Stack
	- 기존에는 Retarget Pose -> Pelvis -> FK -> IK -> Post 순
	- 새로운 방식
		- 모든 작업이 개별 Operation으로 분리
	- **드래그 앤 드롭**으로 순서 변경
		- **개별 설정** : 각 Operation마다 고유한 파라미터
		- **조건부 실행** : 특정 상황에서만 작동하도록 설정
	- 기존
		- IK Rig -> IK Retargeter (필수 의존성)
	- 새로운 방식
		- IK Retargeter 단독 사용 가능

	- **Scale Source**
		- 소스 애니메이션을 대상 메시에 더 비례적으로 맞추도록 스케일링
		- IK 및 Pin Bones 작업과 연동하여 작동
		- Single Operation이라 여러 개를 가질 수 없다

	- **Pin Bone**
		- 로컬 위치를 복사하고 상대적으로 크기를 지정하는 방법을 다루는 새로운 옵션