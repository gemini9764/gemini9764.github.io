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