---
title: AI 2
description: Behavior Tree & Blackboard
author: gemini
date: 2025-07-29 19:30:00 +09:00
categories: [Unreal]
tags: [AI, Behavior Tree&Blackboard]
math: true
mermaid: true
---

#### Behavior Tree & Blackboard
- **Blackboard** : AI의 기억 저장소 (메모리, 데이터베이스)
- **Behavior Tree** : AI의 의사결정 트리 (시각적 로직 설계)

>[Blackboard] <- 정보를 저장하거나 공유<br>
>[Behavior Tree] <- 의사결정 실행함<br>
>[AI Controller] <- 결정된 행동을 명령함<br>
>[Character] <- 월드에서 실제로 행동
{: .prompt-info}

#### Perception 이벤트를 Blackboard 업데이트로 변경하기

>Blackboard = AI의 메모리 + 공유 데이터베이스<br>
> 특징:<br>
> 1. Key-Value 방식으로 데이터 저장<br>
> 2. 여러 AI가 동일한 Blackboard 공유 가능<br>
> 3. 실시간으로 값 변경 가능 4. Behavior Tree에서 조건 판단에 사용
{: prompt-info}

- 주요 데이터 타입들

|타입|용도|예시|
|---|---|---|
|`Object`|액터 참조|추적할 플레이어, 목표물|
|`Vector`|3D 위치|순찰 지점, 마지막 본 위치|
|`Bool`|참/거짓|추적 중인가?, 경계 상태인가?|
|`Float`|실수값|체력, 감지 거리, 속도|
|`Int`|정수값|탄약 수, 순찰 포인트 인덱스|
|`String`|문자열|AI 상태, 디버그 메시지|

- SpartaAIController 클래스에 Blackboard 연결

```
protected:
    // [Blackboard Component] : 실제 실행 중 데이터를 저장하는 "기억장치"
    // 실제 값들을 들고 있음 (Key에 해당하는 실시간 값 저장소)
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "AI")
    UBlackboardComponent* BlackboardComp;

public:
    // Getter 함수 – 외부에서 BlackboardComp에 접근할 수 있게 해줌
    FORCEINLINE UBlackboardComponent* GetBlackboardComp() const 
    { 
        return BlackboardComp; 
    }
```

*SpartaAIController.h*

```
ASpartaAIController::ASpartaAIController()
{
    // 기존 Perception 설정 등...

    // Blackboard Component 생성
    // 이건 실제 데이터를 담는 실행용 컨테이너 (게임 도중 키/값을 저장)
    BlackboardComp = CreateDefaultSubobject<UBlackboardComponent>(TEXT("BlackBoard"));
}
```

*SpartaAIController.cpp*

```
void ASpartaAIController::BeginPlay()
{
    Super::BeginPlay();
    
    if (BlackboardComp)
    {
        // 초기값 설정 – 시작할 때 Blackboard에 값 미리 넣어둠
        // BT에서 이 값들을 조건 판단에 사용할 수 있음
        BlackboardComp->SetValueAsBool(TEXT("CanSeeTarget"), false); // 타겟 탐지 여부 초기화
        BlackboardComp->SetValueAsBool(TEXT("IsInvestigating"), false); // 조사 중 상태 초기화
        UE_LOG(LogTemp, Warning, TEXT("[Sparta] Blackboard initialized successfully"));
    }
    else
    {
        UE_LOG(LogTemp, Error, TEXT("[Sparta] Blackboard Component not found!"));
    }

    // 기존 Perception 관련 이벤트 바인딩은 여기에 계속...
}
```

*SpartaAIController.cpp*

- Perception 이벤트를 Blackboard 업데이트로 변경

```
void ASpartaAIController::OnPerceptionUpdated(AActor* Actor, FAIStimulus Stimulus)
{
    // 플레이어인지 확인
    APawn* PlayerPawn = UGameplayStatics::GetPlayerPawn(GetWorld(), 0);
    if (Actor != PlayerPawn || !BlackboardComp) 
    {
        return;
    }
    
    if (Stimulus.WasSuccessfullySensed())
    {
        // Blackboard에 정보 저장
        BlackboardComp->SetValueAsObject(TEXT("TargetActor"), Actor);
        BlackboardComp->SetValueAsBool(TEXT("CanSeeTarget"), true);
        BlackboardComp->SetValueAsVector(TEXT("TargetLastKnownLocation"), Actor->GetActorLocation());
        BlackboardComp->SetValueAsBool(TEXT("IsInvestigating"), false);
    }
    else
    {
        // 더 이상 보지 못함
        BlackboardComp->SetValueAsBool(TEXT("CanSeeTarget"), false);
        // 조사 모드 시작
        BlackboardComp->SetValueAsBool(TEXT("IsInvestigating"), true);
    }
}
```

*ASpartaAIController.cpp*


#### Behavior Tree  생성하고 기본 구조 만들어보기

- 커스텀 Task 생성 - 랜덤 위치를 찾는 Task

```
#pragma once

#include "CoreMinimal.h"
#include "BehaviorTree/BTTaskNode.h"
#include "BTTask_FindRandomLocation.generated.h"

//어디로 갈지 랜덤하게 정하는 Task
// 현재 위치 주변에서 갈 수 있는 곳을 찾아서 Blackboard에 저장
UCLASS()
class SPARTAPROJECT_API UBTTask_FindRandomLocation : public UBTTaskNode
{
    GENERATED_BODY()

public:
    UBTTask_FindRandomLocation();

protected:
    // 이 Task가 실행될 때 호출되는 핵심 함수
    virtual EBTNodeResult::Type ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory) override;
    
    // 결과를 어떤 Blackboard 키에 저장할지
    UPROPERTY(EditAnywhere, Category = "Blackboard")
    struct FBlackboardKeySelector LocationKey;
    
    // 얼마나 멀리까지 찾을지 (반경)
    UPROPERTY(EditAnywhere, Category = "Search", meta = (ClampMin = "100.0"))
    float SearchRadius = 1000.0f;
};
```

*BTTask_FindRandomLocation.h*

```
#include "BTTask_FindRandomLocation.h"
#include "BehaviorTree/BehaviorTreeComponent.h"
#include "BehaviorTree/BlackboardComponent.h"
#include "AIController.h"
#include "NavigationSystem.h"

UBTTask_FindRandomLocation::UBTTask_FindRandomLocation()
{
    // Behavior Tree 에디터에서 보일 이름
    NodeName = TEXT("Find Random Location");
    
    // 이 키는 Vector(위치) 타입만 받겠다고 필터 설정
    LocationKey.AddVectorFilter(this, GET_MEMBER_NAME_CHECKED(UBTTask_FindRandomLocation, LocationKey));
}

EBTNodeResult::Type UBTTask_FindRandomLocation::ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory)
{
    // 1단계: 필요한 것들 가져오기
    AAIController* AIController = OwnerComp.GetAIOwner();
    if (!AIController) return EBTNodeResult::Failed;
    
    APawn* MyPawn = AIController->GetPawn();
    if (!MyPawn) return EBTNodeResult::Failed;
    
    UNavigationSystemV1* NavSystem = UNavigationSystemV1::GetCurrent(GetWorld());
    if (!NavSystem) return EBTNodeResult::Failed;
    
    // 2단계: 랜덤 위치 찾기
    FNavLocation RandomLocation;
    bool bFound = NavSystem->GetRandomReachablePointInRadius(
        MyPawn->GetActorLocation(),  // 내 위치를 중심으로
        SearchRadius,                // 이 반경 안에서
        RandomLocation               // 결과를 여기 저장
    );
    
    // 3단계: 찾았으면 Blackboard에 저장
    if (bFound)
    {
        UBlackboardComponent* BlackboardComp = OwnerComp.GetBlackboardComponent();
        if (BlackboardComp)
        {
            BlackboardComp->SetValueAsVector(LocationKey.SelectedKeyName, RandomLocation.Location);
            UE_LOG(LogTemp, Log, TEXT("[FindRandom] 새로운 목적지: %s"), *RandomLocation.Location.ToString());
            return EBTNodeResult::Succeeded;  // 성공ㅋㅋ
        }
    }
    
    UE_LOG(LogTemp, Warning, TEXT("[FindRandom] 갈 곳을 찾지 못했습니다"));
    return EBTNodeResult::Failed;  // 실패
}
```

*BTTask_FindRandomLocation.cpp*

- 최종 Behavior Tree 모습

```
Main Decision (Selector)
├─ Chase Player (Sequence)          ← 1순위: 플레이어 보이면 추격
│   ├─ Can See Player? (Decorator)
│   └─ Move to Player (Task)
├─ Investigate (Sequence)           ← 2순위: 조사할 곳 있으면 조사
│   ├─ Is Investigating? (Decorator)
│   └─ Check Last Location (Task)
└─ Patrol (Sequence)                ← 3순위: 할 일 없으면 순찰
    ├─ Find Random Location (Task)
    └─ Move to Random Location (Task)
```


#### AI Controller에 Behavior Tree 연결하기

- SpartaAIController 클래스 수정

```
#include "BehaviorTree/BehaviorTree.h"

protected:
    // Behavior Tree 에셋 참조
    UPROPERTY(EditDefaultsOnly, Category = "AI")
    class UBehaviorTree* BehaviorTreeAsset;

public:
    // Behavior Tree 시작 함수
    void StartBehaviorTree();
```

*SpartaAIController.h*

```
#include "BehaviorTree/BehaviorTreeComponent.h"

void ASpartaAIController::BeginPlay()
{
    Super::BeginPlay();
    
    // Blackboard 초기화 (기존 코드)
    if (BlackboardComp)
    {
        // ... 기존 초기화 코드
        
        // Behavior Tree 시작
        StartBehaviorTree();
    }
    
    // Perception 이벤트 바인딩 (기존 코드)
    if (AIPerception)
    {
        AIPerception->OnTargetPerceptionUpdated.AddDynamic(
            this, 
            &ASpartaAIController::OnPerceptionUpdated
        );
    }
    
    // 기존 타이머 코드는 제거 (Behavior Tree가 대신 처리)
}

void ASpartaAIController::StartBehaviorTree()
{
    if (BehaviorTreeAsset)
    {
        // Behavior Tree 실행 시작
        RunBehaviorTree(BehaviorTreeAsset);
        UE_LOG(LogTemp, Warning, TEXT("[Sparta] Behavior Tree started"));
    }
    else
    {
        UE_LOG(LogTemp, Error, TEXT("[Sparta] Behavior Tree Asset not set!"));
    }
}
```

*SpartaAIController.cpp*